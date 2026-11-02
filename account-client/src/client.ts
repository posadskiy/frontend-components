import { AccountHttpError, isAbortError, readMessage } from './errors.js';
import { AccountSession } from './session.js';
import type {
  AccountClientOptions,
  AccountIdentity,
  AccountPasskey,
  AccountSessionInfo,
  PasskeyCeremony,
  RequestSpec,
  TokenSet,
  UserProfile,
} from './types.js';

const refreshSkewMs = 60_000;
const defaultTimeoutMs = 15_000;

export class AccountClient {
  readonly session = new AccountSession();
  private refreshInflight: Promise<TokenSet> | null = null;

  constructor(private readonly options: AccountClientOptions) {}

  get authUrl(): string {
    return this.options.authUrl;
  }

  async login(input: {
    email: string;
    password: string;
    linkOrigin?: string;
    captchaToken?: string;
    signal?: AbortSignal;
  }): Promise<TokenSet> {
    const body = await this.request<Record<string, unknown>>({
      path: '/login',
      method: 'POST',
      auth: false,
      signal: input.signal,
      body: {
        email: input.email,
        password: input.password,
        ...(input.linkOrigin ? { linkOrigin: input.linkOrigin } : {}),
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
      },
    });
    return this.adopt(body);
  }

  async register(input: {
    email: string;
    password: string;
    linkOrigin: string;
    captchaToken?: string;
    locale?: string;
    timeZone?: string;
    signal?: AbortSignal;
  }): Promise<Record<string, unknown>> {
    return this.request({
      path: '/signup',
      method: 'POST',
      auth: false,
      signal: input.signal,
      body: {
        email: input.email,
        password: input.password,
        linkOrigin: input.linkOrigin,
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
      },
    });
  }

  async forgotPassword(email: string, linkOrigin: string, captchaToken?: string, signal?: AbortSignal): Promise<void> {
    await this.request({
      path: '/account/forgot-password',
      method: 'POST',
      auth: false,
      signal,
      body: { email, linkOrigin, ...(captchaToken ? { captchaToken } : {}) },
    });
  }

  async resetPassword(token: string, password: string, signal?: AbortSignal): Promise<void> {
    await this.request({
      path: '/account/reset-password',
      method: 'POST',
      auth: false,
      signal,
      body: { token, password },
    });
  }

  async verifyEmail(token: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: '/account/verify', method: 'POST', auth: false, signal, body: { token } });
  }

  async confirmEmailChange(token: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: '/account/email/confirm', method: 'POST', auth: false, signal, body: { token } });
  }

  async resendVerification(linkOrigin: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: '/account/verification-email', method: 'POST', signal, body: { linkOrigin } });
  }

  async changePassword(currentPassword: string, password: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: '/account/password', method: 'POST', signal, body: { currentPassword, password } });
  }

  async setPassword(password: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: '/account/password/set', method: 'POST', signal, body: { password } });
  }

  async changeEmail(email: string, linkOrigin: string, password?: string, signal?: AbortSignal): Promise<void> {
    await this.request({
      path: '/account/email',
      method: 'POST',
      signal,
      body: { email, linkOrigin, ...(password ? { password } : {}) },
    });
  }

  async listSessions(signal?: AbortSignal): Promise<AccountSessionInfo[]> {
    return this.request({ path: '/account/sessions', signal });
  }

  async revokeSession(id: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: `/account/sessions/${encodeURIComponent(id)}`, method: 'DELETE', signal });
  }

  async listPasskeys(signal?: AbortSignal): Promise<AccountPasskey[]> {
    return this.request({ path: '/account/passkeys', signal });
  }

  async deletePasskey(id: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: `/account/passkeys/${encodeURIComponent(id)}`, method: 'DELETE', signal });
  }

  async passkeyOptions(signal?: AbortSignal): Promise<PasskeyCeremony> {
    return this.request({ path: '/account/passkeys/options', method: 'POST', signal });
  }

  async finishPasskeyRegistration(challengeId: number, credential: unknown, label?: string, signal?: AbortSignal): Promise<void> {
    await this.request({
      path: '/account/passkeys',
      method: 'POST',
      signal,
      body: { challengeId, credential, ...(label ? { label } : {}) },
    });
  }

  async passkeyLoginOptions(email?: string, signal?: AbortSignal): Promise<PasskeyCeremony> {
    return this.request({
      path: '/login/passkey/options',
      method: 'POST',
      auth: false,
      signal,
      body: email ? { email } : {},
    });
  }

  async finishPasskeyLogin(challengeId: number, credential: unknown, linkOrigin?: string, signal?: AbortSignal): Promise<TokenSet> {
    const body = await this.request<Record<string, unknown>>({
      path: '/login/passkey',
      method: 'POST',
      auth: false,
      signal,
      body: { challengeId, credential, ...(linkOrigin ? { linkOrigin } : {}) },
    });
    return this.adopt(body);
  }

  async listIdentities(signal?: AbortSignal): Promise<AccountIdentity[]> {
    return this.request({ path: '/account/identities', signal });
  }

  async unlinkIdentity(provider: string, signal?: AbortSignal): Promise<void> {
    await this.request({ path: `/account/identities/${encodeURIComponent(provider)}`, method: 'DELETE', signal });
  }

  async exportAccount(signal?: AbortSignal): Promise<unknown> {
    return this.request({ path: '/account/export', signal });
  }

  async eraseAccount(confirmation: string, password?: string, signal?: AbortSignal): Promise<void> {
    await this.request({
      path: '/account/erase',
      method: 'POST',
      signal,
      body: { confirmation, ...(password ? { password } : {}) },
    });
  }

  async fetchCurrentUser(signal?: AbortSignal): Promise<UserProfile> {
    return this.request({ base: 'user', path: '/v0/user/me', signal });
  }

  async updateProfile(
    profile: { displayName?: string; locale?: string; timeZone?: string; avatarUrl?: string },
    signal?: AbortSignal,
  ): Promise<UserProfile> {
    return this.request({ base: 'user', path: '/v0/user/me', method: 'PATCH', signal, body: profile });
  }

  async saveProductPreference(product: string, marketingEmail: boolean, signal?: AbortSignal): Promise<void> {
    await this.request({
      base: 'user',
      path: `/v0/user/me/preferences/${encodeURIComponent(product)}`,
      method: 'PUT',
      signal,
      body: { product, marketingEmail, settings: '{}' },
    });
  }

  /** Uses the access token when it is still fresh. Otherwise refreshes through the cookie. */
  async getAccessToken(): Promise<string | null> {
    const current = this.session.snapshot();
    if (current.accessToken && !expiring(current.expiresAt)) return current.accessToken;
    try {
      return (await this.refresh()).accessToken;
    } catch (error) {
      if (isAbortError(error)) throw error;
      return null;
    }
  }

  /**
   * Asks auth-service to rotate the refresh cookie. Safe for several callers at once:
   * they share one request.
   */
  refresh(): Promise<TokenSet> {
    if (this.refreshInflight) return this.refreshInflight;
    const run = this.performRefresh();
    this.refreshInflight = run;
    return run.finally(() => {
      if (this.refreshInflight === run) this.refreshInflight = null;
    });
  }

  async ensureFresh(): Promise<void> {
    const current = this.session.snapshot();
    if (current.accessToken && !expiring(current.expiresAt)) return;
    try {
      await this.refresh();
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof AccountHttpError && (error.status === 400 || error.status === 401)) {
        this.session.clear();
      }
    }
  }

  async logout(signal?: AbortSignal): Promise<void> {
    try {
      await this.request({ path: '/logout', method: 'POST', auth: false, signal, body: {} });
    } catch (error) {
      if (isAbortError(error)) throw error;
    } finally {
      this.session.clear();
    }
  }

  async request<T = unknown>(spec: RequestSpec): Promise<T> {
    const first = await this.send(spec);
    if (first.status !== 401 || spec.auth === false) return readBody<T>(first);
    try {
      await this.refresh();
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw await httpError(first);
    }
    return readBody<T>(await this.send(spec));
  }

  private async performRefresh(): Promise<TokenSet> {
    const response = await this.send({
      path: '/oauth/token',
      method: 'POST',
      auth: false,
      body: { grant_type: 'refresh_token' },
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) this.session.clear();
      throw await httpError(response);
    }
    return this.adopt(await response.json());
  }

  private adopt(body: Record<string, unknown>): TokenSet {
    const accessToken = text(body.access_token);
    if (!accessToken) throw new AccountHttpError(200, body);
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 0;
    const userId = text(body.user_id) ?? text(body.userId);
    this.session.adopt(accessToken, typeof body.expires_in === 'number' ? body.expires_in : null, userId);
    return { accessToken, expiresIn, userId };
  }

  private async send(spec: RequestSpec): Promise<Response> {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    if (spec.body !== undefined) headers.set('Content-Type', 'application/json');
    if (spec.auth !== false) {
      const token = this.session.snapshot().accessToken;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? defaultTimeoutMs);
    const signal = spec.signal ? AbortSignal.any([spec.signal, timeout]) : timeout;
    try {
      return await (this.options.fetch ?? fetch)(resolveUrl(this.options, spec), {
        method: spec.method ?? 'GET',
        headers,
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        credentials: 'include',
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new AccountHttpError(0, { message: 'The account service took too long to respond.' });
      }
      throw error;
    }
  }
}

function expiring(expiresAt: number | null): boolean {
  return expiresAt != null && expiresAt - refreshSkewMs <= Date.now();
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveUrl(options: AccountClientOptions, spec: RequestSpec): string {
  if (spec.url) return spec.url;
  const base = (spec.base === 'user' ? options.userUrl : options.authUrl)?.replace(/\/$/, '');
  if (!base) throw new Error(spec.base === 'user' ? 'userUrl is required' : 'authUrl is required');
  const path = spec.path ?? '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readBody<T>(response: Response): Promise<T> {
  if (!response.ok) throw await httpError(response);
  if (response.status === 204) return undefined as T;
  const textBody = await response.text();
  if (!textBody) return undefined as T;
  return JSON.parse(textBody) as T;
}

async function httpError(response: Response): Promise<AccountHttpError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return new AccountHttpError(response.status, body ?? { message: readMessage(body) });
}
