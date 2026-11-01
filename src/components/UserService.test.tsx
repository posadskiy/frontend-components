import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestTimeoutMs } from '../api';
import { UserService } from './UserService';

const { get, post, patch, remove } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
}));

const fetchMock = vi.fn();

function httpResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

function expectAuthFetch(url: string, body: unknown) {
  const call = fetchMock.mock.calls.find((entry) => entry[0] === url);
  expect(call).toBeTruthy();
  const init = call?.[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('include');
  expect(init.body).toBe(JSON.stringify(body));
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer super-secret');
}

vi.mock('axios', () => ({
  default: {
    get,
    post,
    patch,
    delete: remove,
    isAxiosError: (error: unknown) =>
      Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError),
  },
}));

const profile = {
  id: 1,
  email: 'ada@example.com',
  emailVerified: true,
  pictureUrl: 'http://cdn.example/a.png',
  createdVia: 'local',
  authProviders: ['google'],
};

function renderProfile(props: Partial<ComponentProps<typeof UserService>> = {}) {
  return render(
    <UserService apiUrl="http://localhost:8095/" userId="me/../other" bearerToken="super-secret" {...props} />,
  );
}

describe('UserService', () => {
  beforeEach(() => {
    localStorage.clear();
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    remove.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => httpResponse(204));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('encodes the user id and does not use an http picture url', async () => {
    get.mockResolvedValue({ data: profile });
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'ada@example.com' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      'http://localhost:8095/v0/user/me%2F..%2Fother',
      expect.objectContaining({
        headers: { Authorization: 'Bearer super-secret' },
        signal: expect.any(AbortSignal),
        timeout: requestTimeoutMs,
      }),
    );
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify email' })).not.toBeInTheDocument();
    expect(screen.queryByText('Display name')).not.toBeInTheDocument();
  });

  it('shows the load error and hides profile actions', async () => {
    const onError = vi.fn();
    get.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 500',
      config: { headers: { Authorization: 'Bearer super-secret' } },
      response: { status: 500, data: { token: 'super-secret' } },
    });
    renderProfile({ onError });

    expect(await screen.findByText('Unable to load the profile.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
    expect(screen.queryByText('ada')).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('Unable to load the profile.');
    expect(JSON.stringify(onError.mock.calls[0][0])).not.toContain('super-secret');
  });

  it('shows an https picture and keeps a verified account free of account actions', async () => {
    get.mockResolvedValue({ data: { ...profile, pictureUrl: 'https://cdn.example/a.png' } });
    renderProfile({ allowDelete: false });

    expect(await screen.findByRole('heading', { name: 'ada@example.com' })).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('Local')).not.toBeInTheDocument();
    expect(screen.queryByText('Google')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/a.png');
    expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify email' })).not.toBeInTheDocument();
    expect(screen.queryByText(/username/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Display name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Language' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Time zone' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Show account details' }));
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
  });

  it('shows a load error when the profile payload is not safe to render', async () => {
    const onError = vi.fn();
    get.mockResolvedValue({
      data: { username: 'ada', email: 'ada@example.com', createdVia: { source: 'local' } },
    });
    renderProfile({ onError });

    expect(await screen.findByText('The user service returned an unexpected response.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ada@example.com' })).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('The user service returned an unexpected response.');
  });

  it('loads the profile at a caller-supplied url', async () => {
    get.mockResolvedValue({ data: profile });
    renderProfile({
      urls: {
        get: '/api/people/{userId}',
        delete: '/api/people/{userId}',
      },
    });

    expect(await screen.findByRole('heading', { name: 'ada@example.com' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      'http://localhost:8095/api/people/me%2F..%2Fother',
      expect.objectContaining({
        headers: { Authorization: 'Bearer super-secret' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('keeps language and time zone as searchable choices until save', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({
      data: { ...profile, displayName: 'Ada', locale: 'de', timeZone: 'Europe/Berlin' },
    });
    patch.mockResolvedValue({
      data: { ...profile, displayName: 'Ada Lovelace', locale: 'de', timeZone: 'Europe/Berlin' },
    });
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.queryByText('Deutsch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show account details' }));
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText(/Berlin/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const name = screen.getByRole('textbox', { name: 'Display name' });
    expect(name).toHaveValue('Ada');
    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(language).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toBeInTheDocument();
    await user.click(language);
    const languageOptions = screen.getAllByRole('option');
    expect(languageOptions.length).toBeGreaterThan(10);
    expect(languageOptions.some((option) => option.textContent === 'ch')).toBe(false);
    expect(languageOptions.some((option) => /German|Deutsch/.test(option.textContent ?? ''))).toBe(true);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Display name' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.clear(screen.getByRole('textbox', { name: 'Display name' }));
    await user.type(screen.getByRole('textbox', { name: 'Display name' }), 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Display name' })).not.toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith(
      'http://localhost:8095/v0/user/me',
      { displayName: 'Ada Lovelace', locale: 'de', timeZone: 'Europe/Berlin', avatarUrl: undefined },
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer super-secret',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  it('retries a failed load', async () => {
    const user = userEvent.setup();
    get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } });
    get.mockResolvedValueOnce({ data: profile });
    renderProfile();

    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'ada@example.com' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('resends the confirmation email for an unverified account', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    get.mockResolvedValue({ data: { ...profile, emailVerified: false } });
    post.mockResolvedValue({ status: 204 });
    renderProfile({
      authApiUrl: 'http://localhost:8100/',
      linkOrigin: 'https://grammarbar.com/verify-email?token=abc',
      onSuccess,
    });

    expect(await screen.findByText('Not verified')).toBeInTheDocument();
    expect(screen.queryByText(/username/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change email' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(await screen.findByText('Confirmation email sent.')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith('Confirmation email sent.');
    expectAuthFetch('http://localhost:8100/account/verification-email', { linkOrigin: 'https://grammarbar.com' });
  });

  it('keeps a custom scheme out of the confirmation request', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { ...profile, emailVerified: false } });
    renderProfile({ linkOrigin: 'grammarbar://auth' });

    await user.click(await screen.findByRole('button', { name: 'Verify email' }));
    expect(await screen.findByText('Use an https address for the confirmation link.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits two minutes before another confirmation email can be sent', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval'] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    get.mockResolvedValue({ data: { ...profile, emailVerified: false } });
    renderProfile({ linkOrigin: 'https://grammarbar.com' });

    try {
      await user.click(await screen.findByRole('button', { name: 'Verify email' }));
      expect(await screen.findByRole('button', { name: 'Resend in 2:00' })).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(119_000);
      expect(screen.getByRole('button', { name: 'Resend in 0:01' })).toBeDisabled();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(screen.getByRole('button', { name: 'Verify email' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a confirmation cooldown that was started in this browser', async () => {
    localStorage.setItem(
      'user-component-react:verification-email:me/../other',
      String(Date.now() + 90_000),
    );
    get.mockResolvedValue({ data: { ...profile, emailVerified: false } });
    renderProfile({ linkOrigin: 'https://grammarbar.com' });

    expect(await screen.findByRole('button', { name: 'Resend in 1:30' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a wait message when confirmation email is rate limited', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { ...profile, emailVerified: false } });
    fetchMock.mockResolvedValue(httpResponse(429, { detail: 'slow down' }));
    renderProfile({ linkOrigin: 'https://grammarbar.com' });

    await user.click(await screen.findByRole('button', { name: 'Verify email' }));
    expect(await screen.findByText('Too many attempts. Wait a minute and try again.')).toBeInTheDocument();
    expect(screen.queryByText('slow down')).not.toBeInTheDocument();
  });

  it('deletes the account only after the email matches', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    get.mockResolvedValue({ data: profile });
    remove.mockResolvedValue({});
    renderProfile({ allowDelete: true, authApiUrl: 'http://localhost:8100', onSuccess, onError });

    await user.click(await screen.findByRole('button', { name: 'Show account details' }));
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    const email = within(dialog).getByRole('textbox', { name: 'Email' });
    await user.type(email, 'wrong@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    expect(await screen.findByText('Email does not match. Please enter your email address to confirm deletion.')).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    await user.clear(email);
    await user.type(email, 'ada@example.com');
    await user.type(within(dialog).getByLabelText('Password'), 'correct horse');
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    expect(await screen.findByText('Your account has been deleted successfully')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith('Your account has been deleted successfully');
    expect(onError).not.toHaveBeenCalled();
    expectAuthFetch('http://localhost:8100/account/erase', { confirmation: 'DELETE', password: 'correct horse' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps profile details behind the expand control', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({
      data: { ...profile, displayName: 'Ada', locale: 'en', timeZone: 'Europe/Ljubljana' },
    });
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('Display name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change email' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show account details' }));
    expect(screen.getByRole('button', { name: 'Hide account details' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Display name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide account details' }));
    expect(screen.queryByText('Display name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
  });

  it('changes the password through auth-service', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    get.mockResolvedValue({ data: profile });
    renderProfile({ authApiUrl: 'http://localhost:8100/', onSuccess });

    await user.click(await screen.findByRole('button', { name: 'Show account details' }));
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Change password' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Current password/), 'oldpassword1');
    await user.type(within(dialog).getByLabelText(/^New password/), 'correcthorse');
    await user.type(within(dialog).getByLabelText(/^Confirm new password/), 'correcthorse');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Password updated. Other sessions have been signed out.')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith('Password updated. Other sessions have been signed out.');
    expectAuthFetch('http://localhost:8100/account/password', {
      currentPassword: 'oldpassword1',
      password: 'correcthorse',
    });
  });

  it('sets a password for a social account and confirms an email change', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({
      data: { ...profile, createdVia: 'Oauth', authProviders: ['google'], emailVerified: true },
    });
    renderProfile({ authApiUrl: 'http://localhost:8100', linkOrigin: 'https://grammarbar.com/account' });

    await user.click(await screen.findByRole('button', { name: 'Show account details' }));
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/^Current password/)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^New password/), 'correcthorse');
    await user.type(within(dialog).getByLabelText(/^Confirm new password/), 'correcthorse');
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }));

    expect(await screen.findByText('Password set. You can sign in with your email and this password.')).toBeInTheDocument();
    expectAuthFetch('http://localhost:8100/account/password/set', { password: 'correcthorse' });

    await user.click(screen.getByRole('button', { name: 'Change email' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^New email/), 'ada.new@example.com');
    await user.type(within(dialog).getByLabelText(/^Current password/), 'correcthorse');
    await user.click(within(dialog).getByRole('button', { name: 'Send confirmation link' }));

    expect(
      await screen.findByText(
        'Confirmation link sent to ada.new@example.com. ada@example.com stays on this account until you open the link.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ada@example.com' })).toBeInTheDocument();
    expectAuthFetch('http://localhost:8100/account/email', {
      email: 'ada.new@example.com',
      linkOrigin: 'https://grammarbar.com',
      password: 'correcthorse',
    });
  });
});
