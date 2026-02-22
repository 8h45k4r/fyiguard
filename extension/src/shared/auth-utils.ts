/**
 * FYI Guard - Authentication Utilities
 *
 * Handles login, register, logout, token management,
 * and auth state persistence via chrome.storage.local.
 */
import { API_ENDPOINTS } from './config';

// Storage keys
const AUTH_KEYS = {
  TOKEN: 'fyiguard_token',
  USER: 'fyiguard_user',
  ORG: 'fyiguard_org',
  POLICY: 'fyiguard_policies',
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

/** Register a new user via backend API */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_ENDPOINTS.events.replace('/events', '/auth/register')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(err.message || `Registration failed (${res.status})`);
  }
  return res.json();
}

/** Login via backend API */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_ENDPOINTS.events.replace('/events', '/auth/login')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Invalid credentials' }));
    throw new Error(err.message || `Login failed (${res.status})`);
  }
  return res.json();
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
  ]);
}

/** Check if user is authenticated */
export async function isAuthenticated(): Promise<boolean> {
  const { token } = await getAuthState();
  return !!token;
}

/** Make an authenticated API request */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { token } = await getAuthState();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(url, { ...options, headers });
}

/** Fetch and cache user's org policies from backend */
export async function syncPolicies(): Promise<void> {
  try {
    const baseUrl = API_ENDPOINTS.events.replace('/events', '');
    const res = await authFetch(`${baseUrl}/policies`);
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
    const baseUrl = API_ENDPOINTS.events.replace('/events', '');
    const res = await authFetch(`${baseUrl}/settings`);
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