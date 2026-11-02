import { describe, expect, it } from 'vitest';
import type { AccountSessionInfo } from '@posadskiy/account-client';
import {
  deviceKind,
  deviceTitle,
  presentSessions,
  resolveCurrentSessionId,
  sessionIdFromAccessToken,
  signedInLabel,
} from './sessionDisplay';

const chromeMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const edgeWindows =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const safariPhone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const firefoxLinux = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0';
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const now = Date.parse('2026-11-02T12:00:00Z');

function token(payload: Record<string, unknown>): string {
  return `aaa.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.zzz`;
}

describe('session display', () => {
  it('names the browser and operating system', () => {
    expect(deviceTitle(chromeMac)).toBe('Chrome on macOS');
    expect(deviceTitle(edgeWindows)).toBe('Edge on Windows');
    expect(deviceTitle(safariPhone)).toBe('Safari on iOS');
    expect(deviceTitle(firefoxLinux)).toBe('Firefox on Linux');
    expect(deviceTitle(androidChrome)).toBe('Chrome on Android');
    expect(deviceTitle('   ')).toBeNull();
    expect(deviceKind(safariPhone)).toBe('phone');
    expect(deviceKind(chromeMac)).toBe('computer');
  });

  it('describes when the session started', () => {
    expect(signedInLabel(new Date(now - 30_000).toISOString(), now)).toBe('Signed in just now');
    expect(signedInLabel(new Date(now - 60_000).toISOString(), now)).toBe('Signed in 1 minute ago');
    expect(signedInLabel(new Date(now - 2 * 3_600_000).toISOString(), now)).toBe('Signed in 2 hours ago');
    expect(signedInLabel(new Date(now - 24 * 3_600_000).toISOString(), now)).toBe('Signed in yesterday');
    expect(signedInLabel(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe('Signed in 3 days ago');
    expect(signedInLabel('not-a-date', now)).toBeNull();
  });

  it('reads a session id from the access token and ignores the token id', () => {
    expect(sessionIdFromAccessToken(token({ sid: 'family-1', jti: 'token-9' }))).toBe('family-1');
    expect(sessionIdFromAccessToken('not-a-jwt')).toBeNull();
    expect(sessionIdFromAccessToken(token({ jti: 'token-9' }))).toBeNull();
  });

  it('picks this device from an explicit id, then the token, then a unique user agent', () => {
    const sessions = [
      { id: 'a', userAgent: chromeMac },
      { id: 'b', userAgent: firefoxLinux },
    ];
    expect(resolveCurrentSessionId(sessions, { explicitId: 'b', accessToken: token({ sid: 'a' }) })).toBe('b');
    expect(resolveCurrentSessionId(sessions, { accessToken: token({ sid: 'a' }), navigatorUserAgent: firefoxLinux })).toBe('a');
    expect(resolveCurrentSessionId(sessions, { navigatorUserAgent: firefoxLinux })).toBe('b');
    expect(
      resolveCurrentSessionId(
        [
          { id: 'a', userAgent: chromeMac },
          { id: 'c', userAgent: chromeMac },
        ],
        { navigatorUserAgent: chromeMac },
      ),
    ).toBeNull();
  });

  it('pins this device and keeps identical rows distinguishable', () => {
    const sessions: AccountSessionInfo[] = [
      { id: 'older-google', provider: 'google', createdAt: new Date(now - 86_400_000).toISOString(), clientIp: '203.0.113.8' },
      { id: 'newer-google', provider: 'google', createdAt: new Date(now - 86_400_000).toISOString(), clientIp: '203.0.113.8' },
      {
        id: 'here',
        provider: 'google',
        userAgent: chromeMac,
        createdAt: new Date(now - 3_600_000).toISOString(),
        clientIp: '203.0.113.10',
      },
    ];

    const views = presentSessions(sessions, 'here', now);

    expect(views.map((view) => view.id)).toEqual(['here', 'older-google', 'newer-google']);
    expect(views[0]).toMatchObject({
      title: 'Chrome on macOS',
      provider: 'Google',
      current: true,
      meta: 'Signed in 1 hour ago · 203.0.113.10',
    });
    expect(views[1].title).toBe('Google');
    expect(views[1].meta).toBe('Signed in yesterday · 203.0.113.8 · ID older-go');
    expect(views[2].meta).toContain('ID newer-go');
  });
});
