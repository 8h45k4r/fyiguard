/**
 * FYI Guard - Extension Configuration
 * API_BASE_URL is injected at build time via webpack.DefinePlugin.
 * Falls back to localhost for development.
 */
declare const process: {
  env: { API_BASE_URL: string; NODE_ENV: string };
};

export const API_BASE_URL: string =
  typeof process !== 'undefined' && process.env?.API_BASE_URL
    ? process.env.API_BASE_URL
    : 'http://localhost:3001';

export const IS_PRODUCTION: boolean =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

export const EXTENSION_VERSION: string = (() => {
  try { return chrome.runtime.getManifest?.()?.version || '0.0.0'; }
  catch { return '0.0.0'; }
})();

/** Supported AI platforms and their hostnames */
export const SUPPORTED_PLATFORMS = [
  { name: 'ChatGPT', hostnames: ['chatgpt.com', 'chat.openai.com'] },
  { name: 'Claude', hostnames: ['claude.ai'] },
  { name: 'Gemini', hostnames: ['gemini.google.com'] },
  { name: 'Copilot', hostnames: ['copilot.microsoft.com'] },
  { name: 'Perplexity', hostnames: ['perplexity.ai', 'www.perplexity.ai'] },
  { name: 'Poe', hostnames: ['poe.com'] },
] as const;

/** API prefix must match backend server.ts API_PREFIX */
const V1 = '/api/v1';

/** API endpoints used by the extension */
export const API_ENDPOINTS = {
  health: `${API_BASE_URL}${V1}/health`,
  auth: `${API_BASE_URL}${V1}/auth`,
  scan: `${API_BASE_URL}${V1}/scan`,
  guard: `${API_BASE_URL}${V1}/guard/check`,
  events: `${API_BASE_URL}${V1}/events`,
  settings: `${API_BASE_URL}${V1}/settings`,
  policies: `${API_BASE_URL}${V1}/policies`,
  alerts: `${API_BASE_URL}${V1}/alerts`,
  behavior: `${API_BASE_URL}${V1}/behavior`,
  organizations: `${API_BASE_URL}${V1}/organizations`,
  analytics: `${API_BASE_URL}${V1}/analytics`,
} as const;