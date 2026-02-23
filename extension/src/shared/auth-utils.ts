/**
 * FYI Guard - Authentication Utilities
 *
 * Handles login, register, logout, token management,
 * and auth state persistence via chrome.storage.local.
 * Supports offline/local mode when backend is unavailable.
 */
import { API_ENDPOINTS } from './config';

// Storage keys
const AUTH_KEYS = {
  TOKEN: 'fyiguard_token',
  USER: 'fyiguard_user',
  ORG: 'fyiguard_org',
  POLICY: 'fyiguard_policies',
  OFFLINE_MODE: 'fyiguard_offline',
};

/** Validated email format */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Minimum 8 chars */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 8;
}

/** Check if email is from public domain */
export function isPublicDomain(email: string): boolean {
  const pub = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','protonmail.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  return pub.includes(domain || '');
}

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  role: string;
  orgId?: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  role?: string;
}

/** Check if the backend API is reachable */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(API_ENDPOINTS.health, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** Generate a simple local user ID */
function generateLocalId(): string {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

/** Generate a local offline token */
function generateLocalToken(): string {
  return 'offline_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 12);
}

/** Register a new user - tries backend first, falls back to local */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthResponse> {
  // Try backend first
  try {
    const res = await fetch(`${API_ENDPOINTS.auth}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(err.message || `Registration failed (${res.status})`);
    }
    await chrome.storage.local.set({ [AUTH_KEYS.OFFLINE_MODE]: false });
    return res.json();
  } catch (err: unknown) {
    // If network error (backend unreachable), create local account
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return createLocalAccount(email);
    }
    // If it's a server error message, re-throw
    throw err;
  }
}

/** Create a local offline account */
async function createLocalAccount(email: string): Promise<AuthResponse> {
  const userId = generateLocalId();
  const token = generateLocalToken();
  await chrome.storage.local.set({ [AUTH_KEYS.OFFLINE_MODE]: true });
  console.info('[FYI Guard] Backend unavailable - created local account for', email);
  return { token, userId, email, role: 'MEMBER' };
}

/** Login via backend API - falls back to local auth */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  // Try backend first
  try {
    const res = await fetch(`${API_ENDPOINTS.auth}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Invalid credentials' }));
      throw new Error(err.message || `Login failed (${res.status})`);
    }
    await chrome.storage.local.set({ [AUTH_KEYS.OFFLINE_MODE]: false });
    return res.json();
  } catch (err: unknown) {
    // If network error, try local login
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return loginLocalAccount(email);
    }
    throw err;
  }
}

/** Login with local offline account */
async function loginLocalAccount(email: string): Promise<AuthResponse> {
  // Check if user previously registered locally
  const data = await chrome.storage.local.get([AUTH_KEYS.USER]);
  const existingUser = data[AUTH_KEYS.USER] as AuthUser | undefined;
  if (existingUser && existingUser.email === email) {
    const token = generateLocalToken();
    await chrome.storage.local.set({ [AUTH_KEYS.OFFLINE_MODE]: true });
    return { token, userId: existingUser.userId, email, role: existingUser.role };
  }
  // No existing local account - create one
  return createLocalAccount(email);
}

/** Check if running in offline mode */
export async function isOfflineMode(): Promise<boolean> {
  const data = await chrome.storage.local.get([AUTH_KEYS.OFFLINE_MODE]);
  return data[AUTH_KEYS.OFFLINE_MODE] === true;
}

/** Save auth state to chrome.storage.local */
export async function saveAuthState(token: string, user: AuthUser): Promise<void> {
  await chrome.storage.local.set({
    [AUTH_KEYS.TOKEN]: token,
    [AUTH_KEYS.USER]: user,
  });
}

/** Get auth state from chrome.storage.local */
export async function getAuthState(): Promise<{ token: string | null; user: AuthUser | null }> {
  const data = await chrome.storage.local.get([AUTH_KEYS.TOKEN, AUTH_KEYS.USER]);
  return {
    token: data[AUTH_KEYS.TOKEN] || null,
    user: data[AUTH_KEYS.USER] || null,
  };
}

/** Clear all auth state from chrome.storage.local */
export async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove([
    AUTH_KEYS.TOKEN,
    AUTH_KEYS.USER,
    AUTH_KEYS.ORG,
    AUTH_KEYS.POLICY,
    AUTH_KEYS.OFFLINE_MODE,
  ]);
}

/** Check if user is authenticated */
export async function isAuthenticated(): Promise<boolean> {
  const { token } = await getAuthState();
  return !!token;
}

/** Make an authenticated API request with offline guard */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const offline = await isOfflineMode();
  if (offline) {
    // Return a mock response for offline mode
    return new Response(JSON.stringify({ offline: true, message: 'Running in offline mode' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { token } = await getAuthState();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(url, { ...options, headers });
}

/** Fetch and cache user's org policies from backend */
export async function syncPolicies(): Promise<void> {
  try {
    const offline = await isOfflineMode();
    if (offline) {
      console.info('[FYI Guard] Offline mode - using local policies');
      return;
    }
    const res = await authFetch(API_ENDPOINTS.policies);
    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({ [AUTH_KEYS.POLICY]: data.policies || [] });
    }
  } catch (err) {
    console.warn('[FYI Guard] Policy sync failed:', err);
  }
}

/** Fetch user settings from backend and merge with local */
export async function syncSettings(): Promise<void> {
  try {
    const offline = await isOfflineMode();
    if (offline) {
      console.info('[FYI Guard] Offline mode - using local settings');
      return;
    }
    const res = await authFetch(API_ENDPOINTS.settings);
    if (res.ok) {
      const data = await res.json();
      const existing = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({
        settings: { ...(existing.settings || {}), ...data },
      });
    }
  } catch (err) {
    console.warn('[FYI Guard] Settings sync failed:', err);
  }
}

export { AUTH_KEYS };
