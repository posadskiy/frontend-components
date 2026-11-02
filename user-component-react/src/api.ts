import axios from 'axios';
import { AccountClient, AccountHttpError } from '@posadskiy/account-client';
import type { User, UserUrls } from './types';

export interface UserRequest {
  apiUrl: string;
  userId: string;
  bearerToken?: string | null;
  signal?: AbortSignal;
  /** Path or absolute URL. `{userId}` is encoded. Defaults to `/v0/user/{userId}`. */
  path?: string;
}

export const defaultUserPath = '/v0/user/{userId}';
export const defaultVerificationEmailPath = '/account/verification-email';
export const requestTimeoutMs = 15_000;

export function userPaths(urls?: UserUrls): { get: string; delete: string } {
  const shared = urls?.user ?? defaultUserPath;
  return {
    get: urls?.get ?? shared,
    delete: urls?.delete ?? shared,
  };
}

export function userUrl(apiUrl: string, userId: string, path: string = defaultUserPath): string {
  const template = path.trim();
  if (template.includes('{userId}') && !userId) {
    throw new Error('A userId is required for this URL.');
  }
  const resolved = template.split('{userId}').join(encodeURIComponent(userId));
  if (/^[a-z][a-z\d+.-]*:/i.test(resolved)) {
    const protocol = resolved.slice(0, resolved.indexOf(':')).toLowerCase();
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error('User URL must be an http(s) URL or a path.');
    }
    return resolved;
  }
  const base = apiUrl.replace(/\/$/, '');
  return `${base}${resolved.startsWith('/') ? resolved : `/${resolved}`}`;
}

export function authHeaders(bearerToken?: string | null): Record<string, string> {
  const token = bearerToken?.trim();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(bearerToken?: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(bearerToken),
  };
}

function requestConfig(request: UserRequest, headers: Record<string, string>) {
  return {
    headers,
    signal: request.signal,
    timeout: requestTimeoutMs,
  };
}

function readUser(value: unknown): User {
  if (!isUser(value)) {
    throw new Error('The user service returned an unexpected response.');
  }
  return value;
}

export async function fetchUser(request: UserRequest): Promise<User> {
  const response = await axios.get(
    userUrl(request.apiUrl, request.userId, request.path),
    requestConfig(request, authHeaders(request.bearerToken)),
  );
  return readUser(response.data);
}

async function authPost(request: UserRequest, path: string, body: unknown): Promise<void> {
  const token = request.bearerToken?.trim() || null;
  const client = new AccountClient({ authUrl: request.apiUrl, timeoutMs: requestTimeoutMs });
  if (token) client.session.adopt(token, null, null);
  await client.request({
    url: userUrl(request.apiUrl, request.userId, path),
    method: 'POST',
    body,
    signal: request.signal,
    auth: Boolean(token),
  });
}

/**
 * Erases the sign-in account through auth-service. user-service `DELETE /v0/user/{id}` is limited to
 * internal callers; people confirm erasure here with the word DELETE, plus the password when the
 * account has one.
 */
export async function changePassword(request: UserRequest, currentPassword: string, password: string): Promise<void> {
  await authPost(request, '/account/password', { currentPassword, password });
}

export async function setPassword(request: UserRequest, password: string): Promise<void> {
  await authPost(request, '/account/password/set', { password });
}

export async function changeEmail(
  request: UserRequest,
  email: string,
  linkOrigin: string,
  password?: string,
): Promise<void> {
  await authPost(request, '/account/email', {
    email,
    linkOrigin: siteOrigin(linkOrigin),
    ...(password ? { password } : {}),
  });
}

export async function eraseAccount(request: UserRequest, password: string): Promise<void> {
  const trimmedPassword = password.trim();
  await authPost(request, '/account/erase', {
    confirmation: 'DELETE',
    ...(trimmedPassword ? { password: trimmedPassword } : {}),
  });
}

/**
 * Origin placed in a confirmation link. Paths, queries, and custom schemes are not sent.
 * `https://grammarbar.com/verify-email?token=1` becomes `https://grammarbar.com`.
 * `http` is kept only for localhost.
 */
export function siteOrigin(value: string): string {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Use an https address for the confirmation link.');
  }
  if (parsed.username || parsed.password || !parsed.host) {
    throw new Error('Use an https address for the confirmation link.');
  }
  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (protocol === 'https:' || (protocol === 'http:' && loopback)) {
    return parsed.origin;
  }
  throw new Error('Use an https address for the confirmation link.');
}

export async function resendVerificationEmail(request: UserRequest, linkOrigin: string): Promise<void> {
  await authPost(request, request.path ?? defaultVerificationEmailPath, { linkOrigin: siteOrigin(linkOrigin) });
}

export function safePictureUrl(url?: unknown): string | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.email !== 'string') return false;
  if (record.emailVerified != null && typeof record.emailVerified !== 'boolean') return false;
  if (record.pictureUrl != null && typeof record.pictureUrl !== 'string') return false;
  if (record.createdVia != null && typeof record.createdVia !== 'string') return false;
  if (record.authProviders != null && !isStringArray(record.authProviders)) return false;
  for (const field of ['displayName', 'locale', 'timeZone', 'avatarUrl'] as const) {
    if (record[field] != null && typeof record[field] !== 'string') return false;
  }
  return true;
}

export async function updateProfile(
  request: UserRequest,
  profile: { displayName?: string; locale?: string; timeZone?: string; avatarUrl?: string },
): Promise<User> {
  const response = await axios.patch(userUrl(request.apiUrl, request.userId, '/v0/user/me'), profile, requestConfig(request, jsonHeaders(request.bearerToken)));
  return readUser(response.data);
}

export async function saveProductPreference(
  request: UserRequest,
  product: string,
  marketingEmail: boolean,
): Promise<void> {
  await axios.put(
    userUrl(request.apiUrl, request.userId, `/v0/user/me/preferences/${encodeURIComponent(product)}`),
    { product, marketingEmail, settings: '{}' },
    requestConfig(request, jsonHeaders(request.bearerToken)),
  );
}

function isAxiosLike(error: unknown): error is { code?: string; response?: { status?: number } } {
  return Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError);
}

function publicStatus(error: unknown): number | undefined {
  if (error instanceof AccountHttpError) return error.status > 0 ? error.status : undefined;
  if (!isAxiosLike(error)) return undefined;
  return error.response?.status;
}

export function toPublicError(error: unknown, fallback: string): Error {
  if (error instanceof AccountHttpError && error.status === 0) {
    return new Error('The user service took too long to respond.');
  }
  if (isAxiosLike(error)) {
    const status = error.response?.status;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new Error('The user service took too long to respond.');
    }
    if (status === 401 || status === 403) return new Error('You are not authorized to perform this action.');
    if (status === 404) return new Error('User not found.');
    if (status === 429) return new Error('Too many attempts. Wait a minute and try again.');
    if (!error.response) return new Error('Unable to reach the user service.');
    return new Error(fallback);
  }
  const status = publicStatus(error);
  if (status === 401 || status === 403) return new Error('You are not authorized to perform this action.');
  if (status === 404) return new Error('User not found.');
  if (status === 429) return new Error('Too many attempts. Wait a minute and try again.');
  if (error instanceof AccountHttpError) return new Error(fallback);
  if (error instanceof Error && error.message) return new Error(error.message);
  return new Error(fallback);
}

export function responseStatus(error: unknown): number | undefined {
  return publicStatus(error);
}

export function accountActionError(
  error: unknown,
  fallback: string,
  byStatus: Partial<Record<number, string>> = {},
): Error {
  const status = responseStatus(error);
  if (status && byStatus[status]) return new Error(byStatus[status]);
  return toPublicError(error, fallback);
}

export function isCanceled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; name?: string };
  return record.code === 'ERR_CANCELED' || record.name === 'CanceledError' || record.name === 'AbortError';
}
