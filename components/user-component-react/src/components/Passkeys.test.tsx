import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Passkeys } from './Passkeys';

const registerPasskey = vi.fn();

vi.mock('@posadskiy/account-client', async () => {
  const actual = await vi.importActual<typeof import('@posadskiy/account-client')>('@posadskiy/account-client');
  return { ...actual, registerPasskey: (...args: unknown[]) => registerPasskey(...args) };
});

const fetchMock = vi.fn();

function httpResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

const passkeys = [
  {
    id: 'key-1',
    label: 'Laptop',
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    lastUsedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  { id: 'key-2', label: null, createdAt: null, lastUsedAt: null },
];

function renderPasskeys() {
  return render(<Passkeys apiUrl="http://localhost:8100" bearerToken="super-secret" />);
}

describe('Passkeys', () => {
  beforeEach(() => {
    registerPasskey.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { credentials: { create: vi.fn() }, userAgent: 'test' });
  });

  it('lists passkeys with a name and when they were used', async () => {
    fetchMock.mockResolvedValue(httpResponse(200, passkeys));
    renderPasskeys();

    expect(await screen.findByRole('heading', { name: 'Passkeys' })).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText(/Added 3 days ago · Last used today/)).toBeInTheDocument();
    expect(screen.getByText('Passkey')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Laptop' })).toBeInTheDocument();
  });

  it('asks before removing a passkey', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return httpResponse(204);
      return httpResponse(200, passkeys);
    });
    renderPasskeys();

    await user.click(await screen.findByRole('button', { name: 'Remove Laptop' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove this passkey?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove passkey' }));

    expect(await screen.findByText('Passkey')).toBeInTheDocument();
    expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
    const deleted = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE');
    expect(String(deleted?.[0])).toBe('http://localhost:8100/account/passkeys/key-1');
  });

  it('registers a passkey with the name from the field', async () => {
    const user = userEvent.setup();
    registerPasskey.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue(httpResponse(200, []));
    renderPasskeys();

    await screen.findByText('No passkeys yet.');
    await user.type(screen.getByRole('textbox', { name: 'Passkey name' }), 'Phone');
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));

    expect(registerPasskey).toHaveBeenCalledWith(expect.anything(), 'Phone');
  });

  it('tells the user when this browser cannot use passkeys', async () => {
    fetchMock.mockResolvedValue(httpResponse(200, []));
    vi.stubGlobal('navigator', { userAgent: 'test' });
    renderPasskeys();

    expect(await screen.findByText('This browser cannot use passkeys.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a passkey' })).not.toBeInTheDocument();
  });
});
