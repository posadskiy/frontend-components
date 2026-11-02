import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOAuthFinalizeForTests } from '../oauth/finalize';
import { OAuthCallback } from './OAuthCallback';

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

function renderCallback(search: string, props: Partial<React.ComponentProps<typeof OAuthCallback>> = {}) {
  window.history.pushState({}, '', `/oauth/callback${search}`);
  const onSuccess = props.onSuccess ?? vi.fn();
  const onError = props.onError ?? vi.fn();
  render(
    <MantineProvider>
      <OAuthCallback oauthApiUrl="http://localhost:8100" onSuccess={onSuccess} onError={onError} {...props} />
    </MantineProvider>,
  );
  return { onSuccess, onError };
}

describe('OAuthCallback', () => {
  beforeEach(() => {
    resetOAuthFinalizeForTests();
    post.mockReset();
    window.history.pushState({}, '', '/oauth/callback');
  });

  it('rejects a missing code without calling finalize', async () => {
    const { onSuccess, onError } = renderCallback('');

    expect(await screen.findByText('Missing OAuth code in callback URL.')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('finalizes a code from the auth host and does not render tokens', async () => {
    post.mockResolvedValue({
      data: {
        access_token: 'super-secret-token',
        refresh_token: 'refresh-secret',
        user_id: '7',
      },
    });

    const { onSuccess } = renderCallback('?code=abc', { returnPath: '/home' });

    expect(await screen.findByText('Sign-in successful!')).toBeInTheDocument();
    expect(screen.queryByText('super-secret-token')).not.toBeInTheDocument();
    expect(screen.queryByText('refresh-secret')).not.toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'super-secret-token', user_id: '7' }),
    );
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('refresh_token');
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8100/oauth2/finalize',
      { code: 'abc', codeVerifier: null },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(window.location.pathname).toBe('/home');
    expect(window.location.search).not.toContain('code=');
  });

  it('hands the full token response to the account client and strips it for onSuccess', async () => {
    post.mockResolvedValue({
      data: { access_token: 'access', refresh_token: 'refresh-secret', expires_in: 900, user_id: '7' },
    });
    const acceptTokens = vi.fn().mockResolvedValue({ accessToken: 'access', expiresIn: 900, userId: '7' });
    const accountClient = { acceptTokens } as unknown as React.ComponentProps<typeof OAuthCallback>['accountClient'];

    const { onSuccess } = renderCallback('?code=native', { accountClient });

    expect(await screen.findByText('Sign-in successful!')).toBeInTheDocument();
    expect(acceptTokens).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'access', refresh_token: 'refresh-secret' }),
    );
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('refresh_token');
  });

  it('removes the code from the url when finalize fails', async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'token store down' } },
    });

    renderCallback('?code=abc&foo=1');

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(window.location.search).toBe('?foo=1');
    expect(screen.queryByText('abc')).not.toBeInTheDocument();
  });

  it('does not sign in when the token payload is incomplete', async () => {
    post.mockResolvedValue({ data: { access_token: 'only-access' } });
    const { onSuccess, onError } = renderCallback('?code=abc');

    expect(await screen.findByText('The auth service returned an unexpected response.')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(window.location.search).not.toContain('code=');
  });
});
