import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptchaTokens } from './tokens';

describe('CaptchaTokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a token that is already waiting', async () => {
    const tokens = new CaptchaTokens();
    tokens.set('  abc  ');
    await expect(tokens.take(1000)).resolves.toBe('abc');
    await expect(tokens.take(5)).resolves.toBeNull();
  });

  it('waits until the widget produces a token', async () => {
    const tokens = new CaptchaTokens();
    const pending = tokens.take(1000);
    tokens.set('abc');
    await expect(pending).resolves.toBe('abc');
  });

  it('gives up when the widget never answers', async () => {
    vi.useFakeTimers();
    const tokens = new CaptchaTokens();
    const pending = tokens.take(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBeNull();
  });

  it('stops waiting when the token is cleared', async () => {
    const tokens = new CaptchaTokens();
    const pending = tokens.take(1000);
    tokens.clear();
    await expect(pending).resolves.toBeNull();
  });
});
