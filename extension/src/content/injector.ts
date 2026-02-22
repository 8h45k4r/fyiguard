/**
 * FYI Guard - Content Script Injector
 *
 * Entry point for the content script that runs on AI platform pages.
 * Responsibilities:
 * 1. Detect which AI platform we're on
 * 2. Load the correct platform adapter
 * 3. Attach prompt scanning via MutationObserver
 * 4. Intercept submit to block/warn on sensitive data
 * 5. Report detection events to the background service worker
 */
import { PromptDetector } from './detector';
import { getAdapterForHost } from './platform-adapters/index';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { UserSettings, Detection } from '../shared/types';
import { debounce, generateEventId, getExtensionVersion, getBrowserInfo } from '../shared/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const INIT_ATTR = 'data-fyiguard-initialized';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Settings Loader
// ---------------------------------------------------------------------------

/** Fetch user settings from chrome.storage via the background worker */
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

// ---------------------------------------------------------------------------
// Event Reporting
// ---------------------------------------------------------------------------

/** Send a detection event to the background service worker */
function reportEvent(detection: Detection, platform: string): void {
  try {
    chrome.runtime.sendMessage({
      type: 'DETECTION_EVENT',
      data: {
        id: generateEventId(),
        eventType: detection.riskLevel === 'CRITICAL' ? 'BLOCK' : 'WARN',
        timestamp: new Date(),
        detection,
        context: {
          platform,
          url: window.location.origin,
          promptLength: 0,
        },
        metadata: {
          extensionVersion: getExtensionVersion(),
          browser: getBrowserInfo(),
          userAction: 'attempted_send' as const,
        },
      },
    });
  } catch (err) {
    console.warn('[FYI Guard] Failed to report:', err);
  }
}

// ---------------------------------------------------------------------------
// Main Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize FYI Guard on the current AI platform page.
 * Retries up to MAX_RETRIES times if the prompt element isn't found yet
 * (common with SPAs that load UI dynamically).
 */
async function initialize(attempt = 0): Promise<void> {
  // Prevent double initialization
  if (document.body.hasAttribute(INIT_ATTR)) return;

  const hostname = window.location.hostname;
  const adapter = getAdapterForHost(hostname);
  const detector = new PromptDetector();
  const settings = await getSettings();

  // Wait for the prompt element to appear
  const input = document.querySelector(adapter.getPromptInputSelector());
  if (!input) {
    if (attempt < MAX_RETRIES) {
      setTimeout(() => initialize(attempt + 1), RETRY_DELAYS[attempt]);
      return;
    }
    console.warn('[FYI Guard] Could not find prompt elements');
    return;
  }

  // Mark as initialized to prevent duplicate setup
  document.body.setAttribute(INIT_ATTR, 'true');

  // Debounced background scanning (non-blocking, for real-time UI hints)
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

  // Observe prompt text changes for real-time scanning
  const promptEl = document.querySelector(adapter.getPromptInputSelector());
  if (promptEl) {
    const observer = new MutationObserver(debouncedScan);
    observer.observe(promptEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // Intercept form submission to scan before sending
  adapter.interceptSubmit(async (text: string): Promise<boolean> => {
    try {
      const result = await detector.scanText(text, settings);

      if (result.blocked) {
        result.detections.forEach((d) =>
          reportEvent(d, adapter.getPlatformName())
        );
        adapter.showBlockedNotification(result.detections);
        return false;
      }

      if (result.detections.length > 0) {
        result.detections.forEach((d) =>
          reportEvent(d, adapter.getPlatformName())
        );
      }

      return true;
    } catch (err) {
      console.error('[FYI Guard] Submit error:', err);
      return true; // Fail open: allow submission if scan fails
    }
  });

  console.log(`[FYI Guard] Active on ${adapter.getPlatformName()}`);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initialize());
} else {
  initialize();
}