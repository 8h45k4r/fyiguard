/**
 * FYI Guard - Platform Adapter Registry
 *
 * Maps hostnames to their corresponding platform adapters.
 * Used by injector.ts to select the correct adapter at runtime.
 */
import { PlatformAdapter } from '../../shared/types';
import { ChatGPTAdapter } from './chatgpt';
import { ClaudeAdapter } from './claude';
import { GeminiAdapter } from './gemini';
import { CopilotAdapter } from './copilot';
import { PerplexityAdapter } from './perplexity';

/**
 * Hostname-to-adapter mapping.
 * Each entry maps a hostname pattern to a factory function
 * that creates the appropriate adapter instance.
 */
const ADAPTER_MAP: Array<{
  hostnames: string[];
  factory: () => PlatformAdapter;
}> = [
  {
    hostnames: ['chatgpt.com', 'chat.openai.com'],
    factory: () => new ChatGPTAdapter(),
  },
  {
    hostnames: ['claude.ai'],
    factory: () => new ClaudeAdapter(),
  },
  {
    hostnames: ['gemini.google.com'],
    factory: () => new GeminiAdapter(),
  },
  {
    hostnames: ['copilot.microsoft.com'],
    factory: () => new CopilotAdapter(),
  },
  {
    hostnames: ['perplexity.ai'],
    factory: () => new PerplexityAdapter(),
  },
];

/**
 * Returns the correct adapter for the given hostname.
 * Falls back to ChatGPT adapter for unrecognized hosts
 * (as a reasonable default for contenteditable UIs).
 */
export function getAdapterForHost(hostname: string): PlatformAdapter {
  for (const entry of ADAPTER_MAP) {
    if (entry.hostnames.some((h) => hostname.includes(h))) {
      return entry.factory();
    }
  }
  // Fallback: ChatGPT adapter uses generic selectors
  return new ChatGPTAdapter();
}

export { ChatGPTAdapter, ClaudeAdapter, GeminiAdapter, CopilotAdapter, PerplexityAdapter };