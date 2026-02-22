// FYI Guard - ChatGPT Platform Adapter
import { PlatformAdapter, Detection } from '../../shared/types';

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

  interceptSubmit(callback: (text: string) => boolean): void {
    const observer = new MutationObserver(() => {
      const btn = document.querySelector(this.getSubmitButtonSelector());
      if (btn && !btn.hasAttribute('data-fyiguard')) {
        btn.setAttribute('data-fyiguard', 'true');
        btn.addEventListener('click', (e) => {
          const text = this.extractPromptText();
          if (text && !callback(text)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, { capture: true });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also intercept Enter key in textarea
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const el = document.activeElement;
        if (el?.matches(this.getPromptInputSelector())) {
          const text = this.extractPromptText();
          if (text && !callback(text)) {
            e.preventDefault();
            e.stopPropagation();
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
      <div class="fyiguard-notification">
        <div class="fyiguard-header">
          <img src="https://certifyi.ai/wp-content/uploads/2025/01/logoblue.svg" alt="FYI Guard" height="24" />
          <h3>Sensitive Data Detected</h3>
        </div>
        <p>${detections.length} sensitive item(s) found in your prompt.</p>
        <ul>${detections.map(d => `<li><strong>${d.category}</strong> (${Math.round(d.confidence * 100)}% confidence)</li>`).join('')}</ul>
        <div class="fyiguard-actions">
          <button class="fyiguard-btn-primary" onclick="this.closest('.fyiguard-overlay').remove()">Edit Prompt</button>
          <button class="fyiguard-btn-secondary" id="fyiguard-details">View Details</button>
        </div>
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