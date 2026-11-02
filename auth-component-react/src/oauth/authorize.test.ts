import { describe, expect, it } from 'vitest';
import { assertSafeAuthorizationUri, resolveOAuthReturnTo } from './authorize';

describe('assertSafeAuthorizationUri', () => {
  it('allows https urls and local http urls', () => {
    expect(assertSafeAuthorizationUri('https://appleid.apple.com/auth/authorize').protocol).toBe('https:');
    expect(assertSafeAuthorizationUri('http://localhost:8080/oauth').hostname).toBe('localhost');
    expect(assertSafeAuthorizationUri('http://127.0.0.1/oauth').hostname).toBe('127.0.0.1');
  });

  it('rejects insecure remote urls and unparseable values', () => {
    expect(() => assertSafeAuthorizationUri('http://evil.example/auth')).toThrow(/HTTPS/);
    expect(() => assertSafeAuthorizationUri('javascript:alert(1)')).toThrow(/HTTPS/);
    expect(() => assertSafeAuthorizationUri('not a url')).toThrow(/invalid authorization URL/);
  });

  it('keeps same-origin return urls and rejects other origins unless allowed', () => {
    expect(resolveOAuthReturnTo('/oauth/callback')).toBe(`${window.location.origin}/oauth/callback`);
    expect(() => resolveOAuthReturnTo('https://evil.example/steal')).toThrow(/not allowed/);
    expect(() => resolveOAuthReturnTo('javascript:alert(1)')).toThrow(/HTTPS/);
    expect(resolveOAuthReturnTo('https://app.example/cb', ['app.example'])).toBe('https://app.example/cb');
    expect(resolveOAuthReturnTo('costy://oauth/callback', ['costy://oauth/callback'])).toBe('costy://oauth/callback');
    expect(() => resolveOAuthReturnTo('costy://oauth/callback')).toThrow(/HTTPS/);
  });

  it('rejects hosts outside the allow list', () => {
    expect(() => assertSafeAuthorizationUri('https://evil.example/auth', ['appleid.apple.com'])).toThrow(/not allowed/);
    expect(assertSafeAuthorizationUri('https://appleid.apple.com/auth', ['appleid.apple.com']).hostname).toBe(
      'appleid.apple.com',
    );
  });
});
