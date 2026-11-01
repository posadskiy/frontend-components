import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigation } from '../navigation';
import { Login } from './Login';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    post,
    isAxiosError: (error: unknown) =>
      Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError),
    isCancel: () => false,
  },
}));

function renderLogin(props: Partial<React.ComponentProps<typeof Login>> = {}) {
  return render(
    <MantineProvider>
      <Login
        apiUrl="http://localhost:8100/login"
        oauthApiUrl="http://localhost:8100"
        providers={['apple', 'google']}
        {...props}
      />
    </MantineProvider>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    post.mockReset();
    vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
  });

  it('shows loading only on the clicked provider and navigates to the auth host', async () => {
    const user = userEvent.setup();
    renderLogin({
      oauthReturnTo: 'https://app.example/oauth/callback',
      allowedReturnToHosts: ['app.example'],
    });

    await user.click(screen.getByRole('button', { name: 'Sign in with Apple' }));

    const apple = screen.getByRole('button', { name: 'Sign in with Apple' });
    const google = screen.getByRole('button', { name: 'Continue with Google' });
    expect(apple).toHaveAttribute('data-loading');
    expect(google).not.toHaveAttribute('data-loading');
    expect(google).toBeDisabled();

    await user.click(google);
    await waitFor(() => expect(navigation.assign).toHaveBeenCalledTimes(1));
    const assigned = vi.mocked(navigation.assign).mock.calls[0][0] as string;
    const assignedUrl = new URL(assigned);
    expect(assignedUrl.origin + assignedUrl.pathname).toBe('http://localhost:8100/oauth2/authorize/apple');
    expect(assignedUrl.searchParams.get('return_to')).toBe('https://app.example/oauth/callback');
    expect(assignedUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(localStorage.getItem('posadskiy.pkce.verifier')).toBeTruthy();
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('does not submit the password form while a provider request is in flight', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in with Apple' }));

    const form = screen.getByRole('textbox', { name: /email/i }).closest('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(axios.post).not.toHaveBeenCalled();
  });

  it('shows invalid credentials for a 401, a generic message for a 500, and the server message for a 400', async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'nope' } },
    });
    renderLogin();

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();

    post.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'Database unavailable' } },
    });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');

    post.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: { status: 400, data: { message: 'Check the email' } },
    });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the email');
  });

  it('does not follow a cross-origin return url unless its host is allowed', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    renderLogin({ onError, oauthReturnTo: 'https://evil.example/steal' });

    await user.click(screen.getByRole('button', { name: 'Sign in with Apple' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('OAuth return URL host is not allowed.');
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('shows an OAuth error and does not redirect to an unsafe auth host', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    renderLogin({ onError, oauthApiUrl: 'http://evil.example' });

    await user.click(screen.getByRole('button', { name: 'Sign in with Apple' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('OAuth authorization URL must use HTTPS.');
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('keeps provider flags and hides a register link that has no handler', () => {
    render(
      <MantineProvider>
        <Login apiUrl="http://localhost:8100/login" enableOAuth enableApple enableGoogle />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'current-password');
  });

  it('renders providers in the given order and a working register link', async () => {
    const user = userEvent.setup();
    const onSwitchToRegister = vi.fn();
    renderLogin({ providers: ['github', 'apple'], onSwitchToRegister });

    const github = screen.getByRole('button', { name: 'Continue with GitHub' });
    const apple = screen.getByRole('button', { name: 'Sign in with Apple' });
    expect(github.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSwitchToRegister).toHaveBeenCalledOnce();
  });

  it('signs in with a short password and sends the page origin', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    post.mockResolvedValue({
      data: { access_token: 'token-value', expires_in: 3600, userId: 'ada' },
    });
    renderLogin({ onSuccess });

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'token-value', expires_in: 3600 }),
      ),
    );
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8100/login',
      { email: 'ada@example.com', password: 'secret', linkOrigin: 'http://localhost:3000' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('asks for a reset link and always shows the same result', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 204, data: { message: 'no such user' } });
    renderLogin({ accountApiUrl: 'http://localhost:8100/login', linkOrigin: 'https://grammarbar.com' });

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('If this account exists, we sent a link.');
    expect(screen.queryByText('no such user')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8100/account/forgot-password',
      { email: 'ada@example.com', linkOrigin: 'https://grammarbar.com' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('keeps an auth service prefix on the reset request', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 204, data: '' });
    renderLogin({
      apiUrl: 'https://api.posadskiy.com/auth/login',
      accountApiUrl: 'https://api.posadskiy.com/auth',
      linkOrigin: 'https://grammarbar.com',
    });

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('If this account exists, we sent a link.');
    expect(post).toHaveBeenCalledWith(
      'https://api.posadskiy.com/auth/account/forgot-password',
      { email: 'ada@example.com', linkOrigin: 'https://grammarbar.com' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('sends the captcha token with a password reset request', async () => {
    const user = userEvent.setup();
    const getCaptchaToken = vi.fn().mockResolvedValue('turnstile-token');
    post.mockResolvedValue({ status: 204, data: '' });
    renderLogin({ getCaptchaToken, linkOrigin: 'https://grammarbar.com' });

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('If this account exists, we sent a link.');
    expect(getCaptchaToken).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8100/account/forgot-password',
      {
        email: 'ada@example.com',
        linkOrigin: 'https://grammarbar.com',
        captchaToken: 'turnstile-token',
      },
      expect.any(Object),
    );
  });

  it('shows a rate-limit message and can return to sign in', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 429',
      response: { status: 429, data: { message: 'slow down' } },
    });
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Please try again later.');
    expect(screen.queryByText('slow down')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8100/account/forgot-password',
      { email: 'ada@example.com', linkOrigin: window.location.origin },
      expect.any(Object),
    );

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends a captcha token only after auth-service asks for one', async () => {
    const user = userEvent.setup();
    const getCaptchaToken = vi.fn().mockResolvedValue('turnstile-token');
    post
      .mockRejectedValueOnce({
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: { status: 400, data: { message: 'Captcha is required' } },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'access', expires_in: 900, refresh_token: 'refresh', user_id: '1' },
      });
    renderLogin({ getCaptchaToken });

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(getCaptchaToken).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8100/login',
      { email: 'ada@example.com', password: 'secret', linkOrigin: window.location.origin },
      expect.any(Object),
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8100/login',
      {
        email: 'ada@example.com',
        password: 'secret',
        linkOrigin: window.location.origin,
        captchaToken: 'turnstile-token',
      },
      expect.any(Object),
    );
  });

  it('shows the captcha above the submit button and keeps it on the reset form', async () => {
    const user = userEvent.setup();
    renderLogin({ captcha: <p>Prove you are human</p> });

    expect(screen.getByText('Prove you are human')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit.previousElementSibling).toHaveTextContent('Prove you are human');

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByText('Prove you are human')).toBeInTheDocument();
  });

  it('hides the forgot-password link when disabled', () => {
    renderLogin({ showForgotPassword: false });
    expect(screen.queryByRole('button', { name: 'Forgot password?' })).not.toBeInTheDocument();
  });
});
