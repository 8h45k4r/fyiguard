import { PlatformAdapter, Detection } from '../../shared/types';
import { BRAND } from '../../shared/theme';

export class ChatGPTAdapter implements PlatformAdapter {
  getPromptInputSelector(): string {
    return 'textarea[data-id="root"], #prompt-textarea, div[contenteditable="true"]';
  }

  getSubmitButtonSelector(): string {
    return 'button[data-testid="send-button"], button[aria-label="Send"]';
  }

  extractPromptText(): string {
    const el = document.querySelector(this.getPromptInputSelector()) as HTMLElement;
    return el?.textContent || (el as HTMLTextAreaElement)?.value || '';
  }

  interceptSubmit(callback: (text: string) => Promise<boolean>): void {
    const observer = new MutationObserver(() => {
      const btn = document.querySelector(this.getSubmitButtonSelector());
      if (btn && !btn.hasAttribute('data-fyiguard')) {
        btn.setAttribute('data-fyiguard', 'true');
        btn.addEventListener('click', async (e) => {
          const text = this.extractPromptText();
          if (text) {
            const allowed = await callback(text);
            if (!allowed) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }, { capture: true });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('keydown', async (e) => {
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
    }, { capture: true });
  }

  showBlockedNotification(detections: Detection[]): void {
    const existing = document.querySelector('.fyiguard-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'fyiguard-overlay';
    overlay.innerHTML = `
      <div class="fyiguard-warning-card">
        <img src="${BRAND.logoUrl}" alt="FYI Guard" height="24" />
        <h2>Sensitive Data Detected</h2>
        <p>${detections.length} sensitive item(s) found in your prompt.</p>
        <div class="fyiguard-detections">
          ${detections.map(d =>
            `<div class="fyiguard-detection-item"><strong>${d.category}</strong> (${Math.round(d.confidence * 100)}%)</div>`
          ).join('')}
        </div>
        <button class="fyiguard-btn fyiguard-btn-block" onclick="this.closest('.fyiguard-overlay').remove()">Edit Prompt</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  getConversationId(): string | null {
    return new URL(window.location.href).pathname.split('/c/')[1] || null;
  }

  getPlatformName(): string {
    return 'ChatGPT';
  }
}

export default ChatGPTAdapter;