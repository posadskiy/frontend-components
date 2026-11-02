import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountClient } from '../client.js';
import { AccountProvider, RequireAuth, useAccountClient, useSession } from './AccountProvider.js';

function SessionProbe() {
  const session = useSession();
  const client = useAccountClient();
  return (
    <button type="button" onClick={() => void client.logout()}>
      {session.accessToken ?? 'signed-out'}
    </button>
  );
}

describe('AccountProvider', () => {
  it('shows the signed-in child and clears it on logout', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = new AccountClient({ authUrl: 'https://api.example/auth', fetch: fetchImpl });
    client.session.adopt('access', 900, '4');

    render(
      <AccountProvider client={client}>
        <RequireAuth fallback={<p>Sign in</p>}>
          <SessionProbe />
        </RequireAuth>
      </AccountProvider>,
    );

    expect(await screen.findByRole('button', { name: 'access' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'access' }));
    expect(await screen.findByText('Sign in')).toBeTruthy();
  });
});
