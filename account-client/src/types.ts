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

/**
 * Where a native app keeps the refresh token, such as the iOS Keychain.
 * auth-service sends `refresh_token` in JSON only to requests without `Sec-Fetch-*` headers,
 * which is what a Capacitor app with native HTTP looks like.
 */
export interface RefreshTokenStore {
  get(): Promise<string | null> | string | null;
  set(token: string | null): Promise<void> | void;
}

export interface AccountClientOptions {
  authUrl: string;
  userUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /**
   * Native apps only. When set, the refresh token from JSON responses is saved here and sent
   * in the body of `/oauth/token` and `/logout`. Leave unset in a browser: auth-service rejects
   * a body token there and uses its httpOnly cookie instead.
   */
  refreshTokenStore?: RefreshTokenStore;
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
