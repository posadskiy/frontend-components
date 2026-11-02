import { describe, expect, it, vi } from 'vitest';
import { AccountClient } from './client.js';
import { AccountHttpError } from './errors.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(fetchImpl: typeof fetch) {
  return new AccountClient({ authUrl: 'https://api.example/auth', userUrl: 'https://api.example/user', fetch: fetchImpl });
}

describe('AccountClient', () => {
  it('keeps the access token in memory and does not send a refresh token', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ access_token: 'access', refresh_token: 'must-not-stick', expires_in: 900, user_id: '4' }),
    );
    const client = clientWith(fetchImpl);

    const tokens = await client.login({ email: 'ada@example.com', password: 'correcthorse' });

    expect(tokens).toEqual({ accessToken: 'access', expiresIn: 900, userId: '4' });
    expect(client.session.snapshot()).toMatchObject({ accessToken: 'access', userId: '4' });
    expect(JSON.stringify(client.session.snapshot())).not.toContain('must-not-stick');
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(init.body).toBe(JSON.stringify({ email: 'ada@example.com', password: 'correcthorse' }));
    expect(String(init.body)).not.toContain('refresh_token');
  });

  it('shares one cookie refresh across callers', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      await gate;
      return jsonResponse({ access_token: 'next', expires_in: 900, user_id: '4' });
    });
    const client = clientWith(fetchImpl);

    const first = client.refresh();
    const second = client.refresh();
    release?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { accessToken: 'next', expiresIn: 900, userId: '4' },
      { accessToken: 'next', expiresIn: 900, userId: '4' },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example/auth/oauth/token');
    expect(init.body).toBe(JSON.stringify({ grant_type: 'refresh_token' }));
    expect(init.credentials).toBe('include');
  });

  it('retries one unauthorized call after the cookie refresh', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh', expires_in: 900, user_id: '4' }))
      .mockResolvedValueOnce(jsonResponse([{ id: 'family' }]));
    const client = clientWith(fetchImpl);
    client.session.adopt('stale', 900, '4');

    await expect(client.listSessions()).resolves.toEqual([{ id: 'family' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const retry = fetchImpl.mock.calls[2] as [string, RequestInit];
    expect(new Headers(retry[1].headers).get('Authorization')).toBe('Bearer fresh');
  });

  it('clears the memory session when the refresh cookie is rejected', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: 'refresh_token is required' }, 400));
    const client = clientWith(fetchImpl);
    client.session.adopt('stale', -1, '4');

    await expect(client.refresh()).rejects.toBeInstanceOf(AccountHttpError);
    expect(client.session.snapshot().accessToken).toBeNull();
  });

  it('clears the memory session even when logout cannot reach auth-service', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const client = clientWith(fetchImpl);
    client.session.adopt('access', 900, '4');

    await client.logout();

    expect(client.session.snapshot().accessToken).toBeNull();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example/auth/logout');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{}');
  });

  describe('with a refreshTokenStore (native app)', () => {
    function memoryStore(initial: string | null = null) {
      let value = initial;
      return {
        get: vi.fn(async () => value),
        set: vi.fn(async (next: string | null) => {
          value = next;
        }),
        peek: () => value,
      };
    }

    function nativeClient(fetchImpl: typeof fetch, store: ReturnType<typeof memoryStore>) {
      return new AccountClient({ authUrl: 'https://api.example/auth', fetch: fetchImpl, refreshTokenStore: store });
    }

    it('saves the refresh token from login', async () => {
      const store = memoryStore();
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ access_token: 'access', refresh_token: 'r1', expires_in: 900, user_id: '4' }),
      );
      const client = nativeClient(fetchImpl, store);

      await client.login({ email: 'ada@example.com', password: 'correcthorse' });

      expect(store.peek()).toBe('r1');
      expect(JSON.stringify(client.session.snapshot())).not.toContain('r1');
    });

    it('refreshes a cold start with the stored token and saves the rotated one', async () => {
      const store = memoryStore('r1');
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ access_token: 'fresh', refresh_token: 'r2', expires_in: 900, user_id: '4' }),
      );
      const client = nativeClient(fetchImpl, store);

      await client.ensureFresh();

      expect(client.session.snapshot().accessToken).toBe('fresh');
      expect(store.peek()).toBe('r2');
      const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example/auth/oauth/token');
      expect(init.body).toBe(JSON.stringify({ grant_type: 'refresh_token', refresh_token: 'r1' }));
    });

    it('does not call auth-service when nothing is stored', async () => {
      const store = memoryStore();
      const fetchImpl = vi.fn();
      const client = nativeClient(fetchImpl as unknown as typeof fetch, store);

      await client.ensureFresh();

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(client.session.snapshot().accessToken).toBeNull();
    });

    it('forgets a rejected refresh token', async () => {
      const store = memoryStore('revoked');
      const fetchImpl = vi.fn(async () => jsonResponse({ detail: 'invalid' }, 401));
      const client = nativeClient(fetchImpl, store);

      await expect(client.refresh()).rejects.toBeInstanceOf(AccountHttpError);
      expect(store.peek()).toBeNull();
    });

    it('keeps the stored token when auth-service cannot be reached', async () => {
      const store = memoryStore('r1');
      const fetchImpl = vi.fn(async () => jsonResponse({ detail: 'down' }, 503));
      const client = nativeClient(fetchImpl, store);

      await client.ensureFresh();

      expect(store.peek()).toBe('r1');
    });

    it('revokes the stored token on logout and clears it', async () => {
      const store = memoryStore('r1');
      const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
      const client = nativeClient(fetchImpl, store);

      await client.logout();

      const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example/auth/logout');
      expect(init.body).toBe(JSON.stringify({ token: 'r1' }));
      expect(store.peek()).toBeNull();
    });

    it('accepts tokens fetched elsewhere, such as an OAuth finalize call', async () => {
      const store = memoryStore();
      const client = nativeClient(vi.fn() as unknown as typeof fetch, store);

      await client.acceptTokens({ access_token: 'access', refresh_token: 'r1', expires_in: 900, user_id: '4' });

      expect(client.session.snapshot()).toMatchObject({ accessToken: 'access', userId: '4' });
      expect(store.peek()).toBe('r1');
    });
  });
});
