import { DetectionEvent } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';

class BackgroundService {
  private eventQueue: DetectionEvent[] = [];

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'DETECTION_EVENT':
          this.handleDetectionEvent(message.data);
          break;
        case 'GET_SETTINGS':
          this.handleGetSettings(sendResponse);
          return true;
        case 'HEALTH_STATUS':
          console.log('[FYI Guard] Health:', message.data);
          break;
      }
            return true;52

    });

    chrome.alarms.create('upload-events', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'upload-events') this.flushEvents();
    });
  }

  private async handleDetectionEvent(event: DetectionEvent): Promise<void> {
    this.eventQueue.push(event);
    chrome.action.setBadgeText({ text: String(this.eventQueue.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
    await chrome.storage.local.set({ [`event_${event.id}`]: event });
  }

  private async handleGetSettings(sendResponse: (r: unknown) => void): Promise<void> {
    const data = await chrome.storage.local.get('settings');
    sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
  }

  private async flushEvents(): Promise<void> {
    if (!this.eventQueue.length) return;
    this.eventQueue = [];
    chrome.action.setBadgeText({ text: '' });
  }
}
new BackgroundService();