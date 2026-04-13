/** In-memory access token + localStorage refresh token (no cookies; Safari-safe). */

const REFRESH_TOKEN_KEY = 'aws-connect-insight:refresh_token';

let accessToken: string | null = null;

let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function setAuthTokens(access: string, refresh: string): void {
  accessToken = access;
  setStoredRefreshToken(refresh);
}

export function clearAuthTokens(): void {
  accessToken = null;
  setStoredRefreshToken(null);
}

export function notifyAuthFailure(): void {
  onAuthFailure?.();
}
