/**
 * FYI Guard - Microsoft Copilot Platform Adapter
 *
 * Selectors for copilot.microsoft.com's chat interface.
 */
import { BasePlatformAdapter, PlatformConfig } from './base';

export class CopilotAdapter extends BasePlatformAdapter {
  protected config: PlatformConfig = {
    promptInputSelector:
      'textarea#searchbox, textarea[placeholder*="message"], div[contenteditable="true"]',
    submitButtonSelector:
      'button[aria-label="Submit"], button[aria-label="Send"], button.submit-button',
    platformName: 'Copilot',
  };
}

export default CopilotAdapter;