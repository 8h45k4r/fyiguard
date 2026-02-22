// FYI Guard - Content Script Entry (Issue 6B: duplicate guard + retry)
import { PromptDetector } from './detector';
import { ChatGPTAdapter } from './platform-adapters/chatgpt';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { SUPPORTED_PLATFORMS } from '../shared/defaultPolicy';
import { BRAND, COLORS, FONTS } from '../shared/theme';
import { debounce, generateEventId, getExtensionVersion, getBrowserInfo } from '../shared/utils';
import { UserSettings, Detection } from '../shared/types';

const INIT_ATTR = 'data-fyiguard-initialized';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const DEBOUNCE_MS = 500;

function getPlatformAdapter(hostname: string) {
  // For MVP, ChatGPT adapter handles most platforms
  if (hostname.includes('chatgpt') || hostname.includes('openai')) return new ChatGPTAdapter();
  return new ChatGPTAdapter(); // Generic fallback
}

async function getSettings(): Promise<UserSettings> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
        resolve(res?.settings || DEFAULT_SETTINGS);
      });
    } catch {
      resolve(DEFAULT_SETTINGS);
    }
  });
}

function reportEvent(detection: Detection, platform: string) {
  try {
    chrome.runtime.sendMessage({
      type: 'DETECTION_EVENT',
      data: {
        id: generateEventId(),
        eventType: detection.riskLevel === 'CRITICAL' ? 'BLOCK' : 'WARN',
        timestamp: new Date(),
        detection,
        context: { platform, url: window.location.origin, promptLength: 0 },
        metadata: { extensionVersion: getExtensionVersion(), browser: getBrowserInfo(), userAction: 'attempted_send' },
      },
    });
  } catch (err) {
    console.warn('[FYI Guard] Failed to report event:', err);
  }
}

function reportHealth(healthy: boolean, platform: string) {
  try {
    chrome.runtime.sendMessage({ type: 'HEALTH_STATUS', data: { healthy, platform, timestamp: Date.now() } });
  } catch { /* background may not be ready */ }
}

async function initialize(attempt = 0): Promise<void> {
  // Duplicate guard
  if (document.body.hasAttribute(INIT_ATTR)) return;

  const hostname = window.location.hostname;
  const adapter = getPlatformAdapter(hostname);
  const detector = new PromptDetector();
  const settings = await getSettings();

  // Verify adapter can find elements (Issue 3B: health check)
  const input = document.querySelector(adapter.getPromptInputSelector());
  if (!input) {
    if (attempt < MAX_RETRIES) {
      console.log(`[FYI Guard] Retry ${attempt + 1}/${MAX_RETRIES} - elements not found`);
      setTimeout(() => initialize(attempt + 1), RETRY_DELAYS[attempt]);
      return;
    }
    console.warn('[FYI Guard] Could not find prompt elements after retries');
    reportHealth(false, adapter.getPlatformName());
    return;
  }

  // Mark as initialized
  document.body.setAttribute(INIT_ATTR, 'true');
  reportHealth(true, adapter.getPlatformName());

  // Set up debounced scanning for real-time warnings (Issue 2B)
  const debouncedScan = debounce(async () => {
    try {
      const text = adapter.extractPromptText();
      if (!text || text.length < 5) return;
      const result = await detector.scanText(text, settings);
      if (result.detections.length > 0) {
        // Show inline warning (non-blocking)
        console.log(`[FYI Guard] ${result.detections.length} issue(s) detected`);
      }
    } catch (err) {
      console.warn('[FYI Guard] Scan error:', err);
    }
  }, DEBOUNCE_MS);

  // Observe input changes for real-time scanning
  const observer = new MutationObserver(debouncedScan);
  const promptEl = document.querySelector(adapter.getPromptInputSelector());
  if (promptEl) {
    observer.observe(promptEl, { childList: true, characterData: true, subtree: true });
  }

  // Intercept submit (final blocking scan)
  adapter.interceptSubmit(async (text: string) => {
    try {
      const result = await detector.scanText(text, settings);
      if (result.blocked) {
        result.detections.forEach(d => reportEvent(d, adapter.getPlatformName()));
        adapter.showBlockedNotification(result.detections);
        return false; // Block
      }
      if (result.detections.length > 0) {
        result.detections.forEach(d => reportEvent(d, adapter.getPlatformName()));
      }
      return true; // Allow
    } catch (err) {
      console.error('[FYI Guard] Submit scan error:', err);
      return true; // Fail open on error
    }
  });

  console.log(`[FYI Guard] Active on ${adapter.getPlatformName()}`);
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initialize());
} else {
  initialize();
}