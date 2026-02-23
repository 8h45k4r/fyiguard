/**
 * FYI Guard - Base Platform Adapter
 *
 * Abstract base class implementing shared logic for all AI platform adapters.
 * Subclasses only need to provide platform-specific CSS selectors and names.
 *
 * Shared behavior:
 * - Submit interception (button click + Enter key)
 * - Blocked notification overlay (CSP-safe, no inline event handlers)
 * - Prompt text extraction
 * - MutationObserver for dynamic button injection
 */
import { PlatformAdapter, Detection } from '../../shared/types';

/**
 * Platform-specific configuration that each adapter must provide.
 * This is the ONLY thing subclasses need to define.
 */
export interface PlatformConfig {
  /** CSS selector(s) for the prompt input element */
  promptInputSelector: string;
  /** CSS selector(s) for the submit/send button */
  submitButtonSelector: string;
  /** Human-readable platform name (e.g. 'Claude', 'Gemini') */
  platformName: string;
  /** Optional: extract conversation ID from URL */
  getConversationId?: () => string | null;
}

export abstract class BasePlatformAdapter implements PlatformAdapter {
  protected abstract config: PlatformConfig;

  getPromptInputSelector(): string {
    return this.config.promptInputSelector;
  }

  getSubmitButtonSelector(): string {
    return this.config.submitButtonSelector;
  }

  getPlatformName(): string {
    return this.config.platformName;
  }

  extractPromptText(): string {
    const el = document.querySelector(
      this.getPromptInputSelector()
    ) as HTMLElement;
    return el?.textContent || (el as HTMLTextAreaElement)?.value || '';
  }

  getConversationId(): string | null {
    if (this.config.getConversationId) {
      return this.config.getConversationId();
    }
    return null;
  }

  interceptSubmit(callback: (text: string) => Promise<boolean>): void {
    // Watch for dynamically-added submit buttons
    const observer = new MutationObserver(() => {
      const btn = document.querySelector(this.getSubmitButtonSelector());
      if (btn && !btn.hasAttribute('data-fyiguard')) {
        btn.setAttribute('data-fyiguard', 'true');
        btn.addEventListener(
          'click',
          async (e) => {
            const text = this.extractPromptText();
            if (text) {
              const allowed = await callback(text);
              if (!allowed) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          },
          { capture: true }
        );
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also intercept Enter key on the prompt input
    document.addEventListener(
      'keydown',
      async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const el = document.activeElement;
          if (el?.matches(this.getPromptInputSelector())) {
            const text = this.extractPromptText();
            if (text) {
              const allowed = await callback(text);
              if (!allowed) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }
        }
      },
      { capture: true }
    );
  }

  showBlockedNotification(detections: Detection[]): void {
    // Remove any existing overlay
    const existing = document.querySelector('.fyiguard-overlay');
    if (existing) existing.remove();

    // Build overlay using DOM APIs (CSP-safe, no inline event handlers)
    const overlay = document.createElement('div');
    overlay.className = 'fyiguard-overlay';

    const card = document.createElement('div');
    card.className = 'fyiguard-warning-card';

    const title = document.createElement('h2');
    title.textContent = '\u{1F6AB} Sensitive Data Detected';
    card.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = `${detections.length} sensitive item(s) found in your prompt.`;
    card.appendChild(desc);

    const detectionList = document.createElement('div');
    detectionList.className = 'fyiguard-detections';
    detections.forEach((d) => {
      const item = document.createElement('div');
      item.className = 'fyiguard-detection-item';
      item.textContent = `\u2022 ${d.category} (${Math.round(d.confidence * 100)}%)`;
      detectionList.appendChild(item);
    });
    card.appendChild(detectionList);

    const editBtn = document.createElement('button');
    editBtn.className = 'fyiguard-btn fyiguard-btn-primary';
    editBtn.textContent = 'Edit Prompt';
    editBtn.addEventListener('click', () => overlay.remove());
    card.appendChild(editBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }
}