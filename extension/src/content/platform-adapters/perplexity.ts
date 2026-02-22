/**
 * FYI Guard - Perplexity Platform Adapter
 *
 * Selectors for perplexity.ai's search/chat interface.
 */
import { BasePlatformAdapter, PlatformConfig } from './base';

export class PerplexityAdapter extends BasePlatformAdapter {
  protected config: PlatformConfig = {
    promptInputSelector:
      'textarea[placeholder*="Ask"], textarea.overflow-auto, div[contenteditable="true"]',
    submitButtonSelector:
      'button[aria-label="Submit"], button[aria-label="Ask"], button.bg-super',
    platformName: 'Perplexity',
  };
}

export default PerplexityAdapter;