/**
 * FYI Guard - Background Service Worker
 *
 * Handles:
 * - Message routing between content scripts and popup
 * - Detection event queuing and batch upload to backend
 * - Badge updates for active detection count
 * - Settings management via chrome.storage
 */
import { DetectionEvent } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { API_ENDPOINTS } from '../shared/config';

/** Maximum events to batch before forcing a flush */
const MAX_QUEUE_SIZE = 50;

/** Alarm name for periodic event upload */
const UPLOAD_ALARM = 'upload-events';

class BackgroundService {
  private eventQueue: DetectionEvent[] = [];

  constructor() {
    this.initializeListeners();
    this.initializeAlarms();
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private initializeListeners(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'DETECTION_EVENT':
          this.handleDetectionEvent(message.data);
          break;
        case 'GET_SETTINGS':
          this.handleGetSettings(sendResponse);
          return true; // Keep channel open for async response
        case 'HEALTH_STATUS':
          console.log('[FYI Guard] Health:', message.data);
          break;
      }
      return true;
    });
  }

  private initializeAlarms(): void {
    chrome.alarms.create(UPLOAD_ALARM, { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === UPLOAD_ALARM) this.flushEvents();
    });
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  private async handleDetectionEvent(event: DetectionEvent): Promise<void> {
    this.eventQueue.push(event);
    chrome.action.setBadgeText({ text: String(this.eventQueue.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
    await chrome.storage.local.set({ [`event_${event.id}`]: event });

    // Auto-flush if queue is getting large
    if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
      await this.flushEvents();
    }
  }

  private async handleGetSettings(
    sendResponse: (r: unknown) => void
  ): Promise<void> {
    const data = await chrome.storage.local.get('settings');
    sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
  }

  // ---------------------------------------------------------------------------
  // Backend Communication
  // ---------------------------------------------------------------------------

  /**
   * Flush queued detection events to the backend API.
   * Silently fails if backend is unreachable (events are lost).
   * In production, consider adding retry logic or local persistence.
   */
  private async flushEvents(): Promise<void> {
    if (!this.eventQueue.length) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];
    chrome.action.setBadgeText({ text: '' });

    try {
      const response = await fetch(API_ENDPOINTS.events, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      });

      if (!response.ok) {
        console.warn(
          `[FYI Guard] Failed to upload events: ${response.status}`
        );
        // Re-queue failed events (up to max size)
        this.eventQueue = [
          ...eventsToSend.slice(0, MAX_QUEUE_SIZE),
          ...this.eventQueue,
        ].slice(0, MAX_QUEUE_SIZE);
      }
    } catch (err) {
      console.warn('[FYI Guard] Backend unreachable:', err);
      // Re-queue events for next flush attempt
      this.eventQueue = [
        ...eventsToSend.slice(0, MAX_QUEUE_SIZE),
        ...this.eventQueue,
      ].slice(0, MAX_QUEUE_SIZE);
    }
  }
}

// Instantiate the background service
new BackgroundService();
