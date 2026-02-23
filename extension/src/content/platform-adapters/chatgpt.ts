/**
 * FYI Guard - ChatGPT Platform Adapter
 *
 * Selectors for chat.openai.com / chatgpt.com.
 * ChatGPT uses a contenteditable div for the prompt input.
 */
import { BasePlatformAdapter, PlatformConfig } from './base';

export class ChatGPTAdapter extends BasePlatformAdapter {
  protected config: PlatformConfig = {
    promptInputSelector:
      'textarea[data-id="root"], #prompt-textarea, div[contenteditable="true"]',
    submitButtonSelector:
      'button[data-testid="send-button"], button[aria-label="Send"]',
    platformName: 'ChatGPT',
    getConversationId: () => {
      const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
      return match?.[1] || null;
    },
  };
}

export default ChatGPTAdapter;