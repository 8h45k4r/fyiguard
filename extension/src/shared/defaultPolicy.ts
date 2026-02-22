import { UserSettings } from './types';

export const DEFAULT_SETTINGS: UserSettings = {
  categories: {
    pii: true,
    financial: true,
    credentials: true,
    medical: true,
    proprietary: true,
  },
  notifications: { email: false, browser: true },
  sensitivity: 'HIGH',
  autoBlock: true,
  whitelistedDomains: [],
  enabledPlatforms: [
    'chatgpt.com',
    'chat.openai.com',
    'claude.ai',
    'gemini.google.com',
    'copilot.microsoft.com',
    'perplexity.ai',
  ],
};

export const SUPPORTED_PLATFORMS = [
  { domain: 'chatgpt.com', name: 'ChatGPT', adapter: 'chatgpt' },
  { domain: 'chat.openai.com', name: 'ChatGPT (Legacy)', adapter: 'chatgpt' },
  { domain: 'claude.ai', name: 'Claude', adapter: 'claude' },
  { domain: 'gemini.google.com', name: 'Gemini', adapter: 'gemini' },
  { domain: 'copilot.microsoft.com', name: 'Copilot', adapter: 'generic' },
  { domain: 'perplexity.ai', name: 'Perplexity', adapter: 'generic' },
] as const;