import type { AuthResponse, OAuthTokenResponse, RegisterResponse } from './types';

export function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.access_token === 'string' && record.access_token.length > 0 && typeof record.expires_in === 'number';
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export function isRegisterResponse(value: unknown): value is RegisterResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.emailVerified === 'boolean';
}

/** Length outside 10–72, or equal to the email, ignoring case. */
export function passwordIssue(password: string, identities: readonly string[]): 'length' | 'identity' | null {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return 'length';
  const candidate = password.toLowerCase();
  for (const identity of identities) {
    const value = identity.trim().toLowerCase();
    if (value && value === candidate) return 'identity';
  }
  return null;
}

export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isOAuthTokenResponse(value: unknown): value is OAuthTokenResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === 'string' &&
    record.access_token.length > 0 &&
    typeof record.user_id === 'string' &&
    record.user_id.length > 0
  );
}

/** Drops a refresh token if a native-shaped body reaches the browser. The cookie is the credential. */
export function withoutRefreshToken<T extends object>(value: T): T {
  if (!('refresh_token' in value)) return value;
  const copy = { ...value };
  delete (copy as { refresh_token?: unknown }).refresh_token;
  return copy;
}
