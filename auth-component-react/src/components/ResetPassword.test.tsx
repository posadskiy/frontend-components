import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPassword } from './ResetPassword';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    post,
    isAxiosError: (error: unknown) =>
      Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError),
    isCancel: () => false,
  },
}));

function renderReset(search: string, props: Partial<React.ComponentProps<typeof ResetPassword>> = {}) {
  window.history.pushState({}, '', `/reset-password${search}`);
  const onSuccess = props.onSuccess ?? vi.fn();
  const onError = props.onError ?? vi.fn();
  render(
    <MantineProvider>
      <ResetPassword accountApiUrl="http://localhost:8100" onSuccess={onSuccess} onError={onError} {...props} />
    </MantineProvider>,
  );
  return { onSuccess, onError };
}

describe('ResetPassword', () => {
  beforeEach(() => {
    post.mockReset();
    window.history.pushState({}, '', '/reset-password');
  });

  it('reports a missing token without calling the account API', async () => {
    const { onSuccess, onError } = renderReset('');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired token');
    expect(post).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('posts the token and new password, then returns through onSuccess', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 204, data: '' });
    const { onSuccess } = renderReset('?token=reset-token');

    await user.type(screen.getByLabelText(/^password/i), 'short');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Password must be 10–72 characters.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/^password/i));
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse');
    await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been updated.');
    expect(post).toHaveBeenCalledWith(
      'http://localhost:8100/account/reset-password',
      { token: 'reset-token', password: 'correct-horse' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(window.location.search).not.toContain('token=');
    expect(screen.queryByText('reset-token')).not.toBeInTheDocument();
  });

  it('shows the same invalid-token error for a bad link', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: { status: 400, data: { message: 'Invalid or expired token' } },
    });
    const { onSuccess } = renderReset('?token=used-token');

    await user.type(screen.getByLabelText(/^password/i), 'correct-horse');
    await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired token');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(window.location.search).toContain('token=used-token');
  });
});
