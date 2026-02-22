import { PromptDetector } from './detector';
import { ChatGPTAdapter } from './platform-adapters/chatgpt';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { UserSettings, Detection } from '../shared/types';
import { debounce, generateEventId, getExtensionVersion, getBrowserInfo } from '../shared/utils';

const INIT_ATTR = 'data-fyiguard-initialized';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const DEBOUNCE_MS = 500;

function getPlatformAdapter(hostname: string) {
  if (hostname.includes('chatgpt') || hostname.includes('openai')) return new ChatGPTAdapter();
  return new ChatGPTAdapter();
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
        metadata: { extensionVersion: getExtensionVersion(), browser: getBrowserInfo(), userAction: 'attempted_send' as const },
      },
    });
  } catch (err) {
    console.warn('[FYI Guard] Failed to report:', err);
  }
}

async function initialize(attempt = 0): Promise<void> {
  if (document.body.hasAttribute(INIT_ATTR)) return;

  const hostname = window.location.hostname;
  const adapter = getPlatformAdapter(hostname);
  const detector = new PromptDetector();
  const settings = await getSettings();

  const input = document.querySelector(adapter.getPromptInputSelector());
  if (!input) {
    if (attempt < MAX_RETRIES) {
      setTimeout(() => initialize(attempt + 1), RETRY_DELAYS[attempt]);
      return;
    }
    console.warn('[FYI Guard] Could not find prompt elements');
    return;
  }

  document.body.setAttribute(INIT_ATTR, 'true');

  const debouncedScan = debounce(async () => {
    try {
      const text = adapter.extractPromptText();
      if (!text || text.length < 5) return;
      const result = await detector.scanText(text, settings);
      if (result.detections.length > 0) {
        console.log(`[FYI Guard] ${result.detections.length} issue(s)`);
      }
    } catch (err) {
      console.warn('[FYI Guard] Scan error:', err);
    }
  }, DEBOUNCE_MS);

  const promptEl = document.querySelector(adapter.getPromptInputSelector());
  if (promptEl) {
    const observer = new MutationObserver(debouncedScan);
    observer.observe(promptEl, { childList: true, characterData: true, subtree: true });
  }

  adapter.interceptSubmit(async (text: string): Promise<boolean> => {
    try {
      const result = await detector.scanText(text, settings);
      if (result.blocked) {
        result.detections.forEach(d => reportEvent(d, adapter.getPlatformName()));
        adapter.showBlockedNotification(result.detections);
        return false;
      }
      if (result.detections.length > 0) {
        result.detections.forEach(d => reportEvent(d, adapter.getPlatformName()));
      }
      return true;
    } catch (err) {
      console.error('[FYI Guard] Submit error:', err);
      return true;
    }
  });

  console.log(`[FYI Guard] Active on ${adapter.getPlatformName()}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initialize());
} else {
  initialize();
}