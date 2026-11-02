export interface TokenSet {
  accessToken: string;
  expiresIn: number;
  userId: string | null;
}

export interface AccountSessionInfo {
  id: string;
  provider?: string | null;
  userAgent?: string | null;
  clientIp?: string | null;
  createdAt?: string | null;
}

export interface AccountIdentity {
  provider: string;
  email?: string | null;
}

export interface AccountPasskey {
  id: string;
  label?: string | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

export interface UserProfile {
  id?: number | string | null;
  email: string;
  emailVerified?: boolean | null;
  pictureUrl?: string | null;
  createdVia?: string | null;
  authProviders?: string[] | null;
  displayName?: string | null;
  locale?: string | null;
  timeZone?: string | null;
  avatarUrl?: string | null;
}

export interface PasskeyCeremony {
  challengeId: number;
  publicKey: Record<string, unknown>;
}

export interface AccountClientOptions {
  authUrl: string;
  userUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestSpec {
  method?: HttpMethod;
  /** Path appended to the auth or user base, or an absolute http(s) URL when `url` is set. */
  path?: string;
  url?: string;
  base?: 'auth' | 'user';
  body?: unknown;
  signal?: AbortSignal;
  /** Send the bearer token and retry once after a cookie refresh. Default true. */
  auth?: boolean;
}
