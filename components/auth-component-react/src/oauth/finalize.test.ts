import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { resetOAuthFinalizeForTests, subscribeFinalize } from './finalize';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    post,
    isAxiosError: (error: unknown) =>
      Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError),
    isCancel: (error: unknown) =>
      Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'ERR_CANCELED'),
  },
}));

describe('subscribeFinalize', () => {
  beforeEach(() => {
    resetOAuthFinalizeForTests();
    post.mockReset();
  });

  it('shares one request and aborts only after the last subscriber leaves', async () => {
    let signal: AbortSignal | undefined;
    post.mockImplementation((_url: string, _body: unknown, config: { signal: AbortSignal }) => {
      signal = config.signal;
      return new Promise(() => undefined);
    });

    const first = subscribeFinalize('http://localhost:8100', 'code');
    const second = subscribeFinalize('http://localhost:8100', 'code');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8100/oauth2/finalize',
      { code: 'code', codeVerifier: null },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    first.unsubscribe();
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(signal?.aborted).toBe(false);

    second.unsubscribe();
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(signal?.aborted).toBe(true);
  });
});
