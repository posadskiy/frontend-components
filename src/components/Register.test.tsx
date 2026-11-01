import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserRegion } from '../region';
import { Register } from './Register';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post,
    isAxiosError: (error: unknown) =>
      Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError),
    isCancel: () => false,
  },
}));

describe('Register', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('uses sign-up copy for Apple and shows a conflict as an account error', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 409',
      response: { status: 409, data: { message: 'duplicate' } },
    });

    render(
      <MantineProvider>
        <Register apiUrl="http://localhost:8095/signup" providers={['apple', 'google']} />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Sign up with Apple' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password');

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByText('Password must be 10–72 characters.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/^password/i));
    await user.type(screen.getByLabelText(/^password/i), 'secret12ab');
    await user.type(screen.getByLabelText(/confirm password/i), 'secret12ab');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with these details already exists');
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8095/signup',
      {
        email: 'ada@example.com',
        password: 'secret12ab',
        linkOrigin: window.location.origin,
        ...browserRegion(),
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects a password that matches the email', async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <Register apiUrl="http://localhost:8095/signup" />
      </MantineProvider>,
    );

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/confirm password/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Password must not match your email.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('sends only the site origin and treats emailVerified false as a created account', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    post.mockResolvedValue({ status: 201, data: { emailVerified: false } });

    render(
      <MantineProvider>
        <Register apiUrl="http://localhost:8095/signup" linkOrigin="https://grammarbar.com/" onSuccess={onSuccess} />
      </MantineProvider>,
    );

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret12ab');
    await user.type(screen.getByLabelText(/confirm password/i), 'secret12ab');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ emailVerified: false }));
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8095/signup',
      expect.objectContaining({ linkOrigin: 'https://grammarbar.com' }),
      expect.any(Object),
    );
  });

  it('does not post when linkOrigin includes a path', async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <Register apiUrl="http://localhost:8095/signup" linkOrigin="https://grammarbar.com/signup" />
      </MantineProvider>,
    );

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret12ab');
    await user.type(screen.getByLabelText(/confirm password/i), 'secret12ab');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('linkOrigin must be a site origin, such as https://grammarbar.com');
    expect(post).not.toHaveBeenCalled();
  });
});
