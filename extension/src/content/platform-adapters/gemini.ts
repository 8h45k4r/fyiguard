/**
 * FYI Guard - Gemini Platform Adapter
 *
 * Selectors for gemini.google.com's chat interface.
 * Gemini uses a rich-text contenteditable area and
 * a send button with specific data attributes.
 */
import { BasePlatformAdapter, PlatformConfig } from './base';

export class GeminiAdapter extends BasePlatformAdapter {
  protected config: PlatformConfig = {
    promptInputSelector:
      'div.ql-editor[contenteditable="true"], .text-input-field textarea',
    submitButtonSelector:
      'button.send-button, button[aria-label="Send message"], button[mattooltip="Send message"]',
    platformName: 'Gemini',
  };
}

export default GeminiAdapter;