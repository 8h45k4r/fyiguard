// FYI Guard - Default Policy (Local-First, Issue 4C)
// Bundled with the extension so it works fully offline.
// Backend policies override/extend these defaults when available.
import { Policy, UserSettings } from './types';

export const DEFAULT_SETTINGS: UserSettings = {
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

export const DEFAULT_POLICY: Policy = {
  id: 'default_local',
  userId: 'local',
  name: 'Default Protection',
  enabled: true,
  rules: [
    { category: 'API_KEY', action: 'BLOCK', exceptions: [] },
    { category: 'PRIVATE_KEY', action: 'BLOCK', exceptions: [] },
    { category: 'DB_CREDENTIALS', action: 'BLOCK', exceptions: [] },
    { category: 'CREDIT_CARD', action: 'BLOCK', exceptions: [] },
    { category: 'SSN', action: 'BLOCK', exceptions: [] },
    { category: 'PII', action: 'BLOCK', exceptions: [] },
    { category: 'PHI', action: 'BLOCK', exceptions: [] },
    { category: 'JWT_TOKEN', action: 'WARN', exceptions: [] },
    { category: 'EMAIL', action: 'WARN', exceptions: [] },
    { category: 'INTERNAL_URL', action: 'WARN', exceptions: [] },
    { category: 'CONFIDENTIAL', action: 'WARN', exceptions: [] },
    { category: 'PHONE', action: 'WARN', exceptions: [] },
    { category: 'ADDRESS', action: 'WARN', exceptions: [] },
  ],
  platforms: ['chatgpt.com', 'claude.ai', 'gemini.google.com'],
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const SUPPORTED_PLATFORMS = [
  { domain: 'chatgpt.com', name: 'ChatGPT', adapter: 'chatgpt' },
  { domain: 'chat.openai.com', name: 'ChatGPT (Legacy)', adapter: 'chatgpt' },
  { domain: 'claude.ai', name: 'Claude', adapter: 'claude' },
  { domain: 'gemini.google.com', name: 'Gemini', adapter: 'gemini' },
  { domain: 'copilot.microsoft.com', name: 'Copilot', adapter: 'generic' },
  { domain: 'perplexity.ai', name: 'Perplexity', adapter: 'generic' },
] as const;