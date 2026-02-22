// FYI Guard - Background Service Worker
import { DetectionEvent } from '../shared/types';

class BackgroundService {
  private eventQueue: DetectionEvent[] = [];
  private apiEndpoint = 'https://api.fyiguard.com/v1';

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'DETECTION_EVENT':
          this.handleDetectionEvent(message.data);
          break;
        case 'GET_POLICIES':
          this.handleGetPolicies(sendResponse);
          return true;
        case 'GET_SETTINGS':
          this.handleGetSettings(sendResponse);
          return true;
        case 'SYNC_NOW':
          this.syncPolicies();
          break;
      }
    });

    chrome.alarms.create('sync-policies', { periodInMinutes: 5 });
    chrome.alarms.create('upload-events', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'sync-policies') this.syncPolicies();
      if (alarm.name === 'upload-events') this.uploadQueuedEvents();
    });
  }

  private async handleDetectionEvent(event: DetectionEvent): Promise<void> {
    this.eventQueue.push(event);
    chrome.action.setBadgeText({ text: String(this.eventQueue.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
    await chrome.storage.local.set({ [`event_${event.id}`]: event });
  }

  private async handleGetPolicies(sendResponse: (r: any) => void): Promise<void> {
    const data = await chrome.storage.local.get('policies');
    sendResponse({ policies: data.policies || [] });
  }

  private async handleGetSettings(sendResponse: (r: any) => void): Promise<void> {
    const data = await chrome.storage.local.get('settings');
    sendResponse({
      settings: data.settings || {
        notifications: { email: false, browser: true },
        sensitivity: 'HIGH',
        autoBlock: true,
        whitelistedDomains: [],
        enabledPlatforms: ['chatgpt.com', 'claude.ai', 'gemini.google.com'],
      },
    });
  }

  private async syncPolicies(): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) return;
      const res = await fetch(`${this.apiEndpoint}/policies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        await chrome.storage.local.set({ policies: data.policies });
      }
    } catch (err) {
      console.error('[FYI Guard] Sync failed:', err);
    }
  }

  private async uploadQueuedEvents(): Promise<void> {
    if (!this.eventQueue.length) return;
    try {
      const token = await this.getAuthToken();
      if (!token) return;
      await fetch(`${this.apiEndpoint}/events/batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: this.eventQueue }),
      });
      this.eventQueue = [];
      chrome.action.setBadgeText({ text: '' });
    } catch (err) {
      console.error('[FYI Guard] Upload failed:', err);
    }
  }

  private async getAuthToken(): Promise<string | null> {
    const data = await chrome.storage.local.get('auth');
    return data.auth?.accessToken || null;
  }
}

const service = new BackgroundService();