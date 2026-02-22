/**
 * FYI Guard - Claude Platform Adapter
 *
 * Selectors for claude.ai's chat interface.
 * Claude uses a contenteditable div for prompt input
 * and a button with specific aria labels for sending.
 */
import { BasePlatformAdapter, PlatformConfig } from './base';

export class ClaudeAdapter extends BasePlatformAdapter {
  protected config: PlatformConfig = {
    promptInputSelector:
      'div[contenteditable="true"].ProseMirror, div.ProseMirror[contenteditable]',
    submitButtonSelector:
      'button[aria-label="Send Message"], button[data-testid="send-button"]',
    platformName: 'Claude',
    getConversationId: () => {
      const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
      return match?.[1] || null;
    },
  };
}

export default ClaudeAdapter;