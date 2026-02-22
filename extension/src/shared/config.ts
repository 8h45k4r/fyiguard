/**
 * FYI Guard - Extension Configuration
 *
 * Centralized configuration for the Chrome extension.
 * API_BASE_URL is injected at build time via webpack.DefinePlugin.
 * Falls back to localhost for development.
 */

// Declare the build-time injected variable
declare const process: {
  env: {
    API_BASE_URL: string;
    NODE_ENV: string;
  };
};

/** Backend API base URL (no trailing slash) */
export const API_BASE_URL: string =
  typeof process !== 'undefined' && process.env?.API_BASE_URL
    ? process.env.API_BASE_URL
    : 'http://localhost:3001';

/** Whether the extension is running in production mode */
export const IS_PRODUCTION: boolean =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

/** Extension version from manifest */
export const EXTENSION_VERSION: string = (() => {
  try {
    return chrome.runtime.getManifest?.()?.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

/** Supported AI platforms and their hostnames */
export const SUPPORTED_PLATFORMS = [
  { name: 'ChatGPT', hostnames: ['chatgpt.com', 'chat.openai.com'] },
  { name: 'Claude', hostnames: ['claude.ai'] },
  { name: 'Gemini', hostnames: ['gemini.google.com'] },
  { name: 'Copilot', hostnames: ['copilot.microsoft.com'] },
  { name: 'Perplexity', hostnames: ['perplexity.ai'] },
] as const;

/** API endpoints used by the extension */
export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/api/health`,
  scan: `${API_BASE_URL}/api/scan`,
  guard: `${API_BASE_URL}/api/guard/check`,
  events: `${API_BASE_URL}/api/events`,
  settings: `${API_BASE_URL}/api/settings`,
} as const;