/**
 * FYI Guard - Background Service Worker
 *
 * Handles:
 * - Auth message routing (LOGIN, REGISTER, LOGOUT, CHECK_AUTH)
 * - Message routing between content scripts and popup
 * - Detection event queuing and batch upload to backend
 * - Badge updates for active detection count
 * - Settings management via chrome.storage
 * - Behavior tracking sessions
 * - Admin alert forwarding
 * - Policy sync on auth
 */
import { DetectionEvent, BehaviorTrackingEvent } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { API_ENDPOINTS } from '../shared/config';
import {
  loginUser,
  registerUser,
  saveAuthState,
  getAuthState,
  clearAuthState,
  syncPolicies,
  syncSettings,
  authFetch,
} from '../shared/auth-utils';

const MAX_QUEUE_SIZE = 50;
const UPLOAD_ALARM = 'upload-events';
const SYNC_ALARM = 'sync-policies';

class BackgroundService {
  private eventQueue: DetectionEvent[] = [];
  private behaviorQueue: BehaviorTrackingEvent[] = [];
  private activePlatform: string | null = null;
  private sessionStartTime: number | null = null;

  constructor() {
    this.initializeListeners();
    this.initializeAlarms();
  }

  private initializeListeners(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'LOGIN':
          this.handleLogin(message.data, sendResponse);
          return true;
        case 'REGISTER':
          this.handleRegister(message.data, sendResponse);
          return true;
        case 'LOGOUT':
          this.handleLogout(sendResponse);
          return true;
        case 'CHECK_AUTH':
          this.handleCheckAuth(sendResponse);
          return true;
        case 'DETECTION_EVENT':
          this.handleDetectionEvent(message.data);
          break;
        case 'GET_SETTINGS':
          this.handleGetSettings(sendResponse);
          return true;
        case 'HEALTH_STATUS':
          console.log('[FYI Guard] Health:', message.data);
          break;
        case 'BEHAVIOR_EVENT':
          this.handleBehaviorEvent(message.data);
          break;
        case 'SESSION_START':
          this.handleSessionStart(message.data);
          break;
        case 'SESSION_END':
          this.handleSessionEnd(message.data);
          break;
        case 'SEND_ALERT':
          this.sendAdminAlert(message.data);
          break;
        case 'SYNC_POLICIES':
          syncPolicies();
          break;
        case 'SETTINGS_UPDATED':
          chrome.storage.local.set({ settings: message.settings });
          break;
      }
      return true;
    });
  }

  private initializeAlarms(): void {
    chrome.alarms.create(UPLOAD_ALARM, { periodInMinutes: 1 });
    chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === UPLOAD_ALARM) this.flushEvents();
      if (alarm.name === SYNC_ALARM) {
        syncPolicies();
        syncSettings();
      }
    });
  }

  // --- Auth Handlers ---

  private async handleLogin(
    data: { email: string; password: string },
    sendResponse: (r: unknown) => void
  ): Promise<void> {
    try {
      const res = await loginUser(data.email, data.password);
      await saveAuthState(res.token, {
        userId: res.userId,
        email: res.email,
        role: res.role || 'MEMBER',
      });
      await syncPolicies();
      await syncSettings();
      sendResponse({ success: true, data: res });
    } catch (err: unknown) {
      sendResponse({ success: false, error: err instanceof Error ? err.message : 'Login failed' });
    }
  }

  private async handleRegister(
    data: { email: string; password: string; name?: string },
    sendResponse: (r: unknown) => void
  ): Promise<void> {
    try {
      const res = await registerUser(data.email, data.password, data.name);
      await saveAuthState(res.token, {
        userId: res.userId,
        email: res.email,
        role: res.role || 'MEMBER',
      });
      sendResponse({ success: true, data: res });
    } catch (err: unknown) {
      sendResponse({ success: false, error: err instanceof Error ? err.message : 'Registration failed' });
    }
  }

  private async handleLogout(sendResponse: (r: unknown) => void): Promise<void> {
    await clearAuthState();
    sendResponse({ success: true });
  }

  private async handleCheckAuth(sendResponse: (r: unknown) => void): Promise<void> {
    const { token, user } = await getAuthState();
    sendResponse({
      isAuthenticated: !!token,
      token: token || null,
      user: user || null,
    });
  }

  // --- Detection Events ---

  private async handleDetectionEvent(event: DetectionEvent): Promise<void> {
    this.eventQueue.push(event);
    chrome.action.setBadgeText({ text: String(this.eventQueue.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
    await chrome.storage.local.set({ [`event_${event.id}`]: event });
    if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
      await this.flushEvents();
    }
  }

  private async handleGetSettings(sendResponse: (r: unknown) => void): Promise<void> {
    const data = await chrome.storage.local.get('settings');
    sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
  }

  // --- Backend Communication ---

  private async flushEvents(): Promise<void> {
    if (!this.eventQueue.length) return;
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];
    chrome.action.setBadgeText({ text: '' });
    try {
      const response = await authFetch(API_ENDPOINTS.events, {
        method: 'POST',
        body: JSON.stringify({ events: eventsToSend }),
      });
      if (!response.ok) {
        this.eventQueue = [...eventsToSend.slice(0, MAX_QUEUE_SIZE), ...this.eventQueue].slice(0, MAX_QUEUE_SIZE);
      }
    } catch {
      this.eventQueue = [...eventsToSend.slice(0, MAX_QUEUE_SIZE), ...this.eventQueue].slice(0, MAX_QUEUE_SIZE);
    }
  }

  // --- Behavior Tracking ---

  private async handleBehaviorEvent(event: BehaviorTrackingEvent): Promise<void> {
    this.behaviorQueue.push(event);
    if (this.behaviorQueue.length >= 10) await this.flushBehaviorEvents();
  }

  private async handleSessionStart(data: { userId: string; orgId: string; platform: string }): Promise<void> {
    this.activePlatform = data.platform;
    this.sessionStartTime = Date.now();
    try {
      const baseUrl = API_ENDPOINTS.events.replace('/events', '');
      await authFetch(`${baseUrl}/behavior/session/start`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn('[FYI Guard] Failed to start session:', err);
    }
  }

  private async handleSessionEnd(data: { userId: string; platform: string }): Promise<void> {
    try {
      const baseUrl = API_ENDPOINTS.events.replace('/events', '');
      await authFetch(`${baseUrl}/behavior/session/end`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      this.activePlatform = null;
      this.sessionStartTime = null;
    } catch (err) {
      console.warn('[FYI Guard] Failed to end session:', err);
    }
  }

  private async flushBehaviorEvents(): Promise<void> {
    if (!this.behaviorQueue.length) return;
    const eventsToSend = [...this.behaviorQueue];
    this.behaviorQueue = [];
    try {
      const baseUrl = API_ENDPOINTS.events.replace('/events', '');
      for (const event of eventsToSend) {
        await authFetch(`${baseUrl}/behavior/event`, {
          method: 'POST',
          body: JSON.stringify(event),
        });
      }
    } catch {
      this.behaviorQueue = [...eventsToSend, ...this.behaviorQueue];
    }
  }

  // --- Admin Alerts ---

  private async sendAdminAlert(data: {
    orgId: string; userId: string; category: string;
    riskLevel: string; platform: string; details: string;
  }): Promise<void> {
    try {
      const baseUrl = API_ENDPOINTS.events.replace('/events', '');
      await authFetch(`${baseUrl}/alerts`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn('[FYI Guard] Failed to send alert:', err);
    }
  }
}

new BackgroundService();