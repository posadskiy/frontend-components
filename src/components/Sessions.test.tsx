import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sessions } from './Sessions';

const fetchMock = vi.fn();

const chromeMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const firefoxWindows =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

function httpResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

const sessions = [
  {
    id: 'here',
    provider: 'google',
    userAgent: chromeMac,
    clientIp: '203.0.113.10',
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: 'other',
    provider: 'google',
    userAgent: firefoxWindows,
    clientIp: '198.51.100.4',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 'plain-a',
    provider: 'google',
    clientIp: '192.0.2.1',
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 'plain-b',
    provider: 'google',
    clientIp: '192.0.2.2',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

function renderSessions(props: Partial<ComponentProps<typeof Sessions>> = {}) {
  return render(<Sessions apiUrl="http://localhost:8100" bearerToken="super-secret" {...props} />);
}

describe('Sessions', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { userAgent: chromeMac });
  });

  it('shows the device, when it signed in, and which row is this browser', async () => {
    fetchMock.mockResolvedValue(httpResponse(200, sessions));
    renderSessions();

    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.getByText('Firefox on Windows')).toBeInTheDocument();
    expect(screen.getByText(/Signed in 3 days ago · 203\.0\.113\.10/)).toBeInTheDocument();
    expect(screen.getByText(/192\.0\.2\.1/)).toBeInTheDocument();
    expect(screen.getByText(/192\.0\.2\.2/)).toBeInTheDocument();
    expect(screen.getAllByText('Google').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Sign out all other sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out this device, Chrome on macOS/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out this session' })).not.toBeInTheDocument();
  });

  it('asks before signing out one session and leaves the others in place', async () => {
    const user = userEvent.setup();
    const onRevoked = vi.fn();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return httpResponse(204);
      return httpResponse(200, sessions);
    });
    renderSessions({ onRevoked });

    await user.click(await screen.findByRole('button', { name: /Sign out Firefox on Windows/ }));
    expect(screen.getByRole('dialog', { name: 'Sign out this session?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.queryByText('Firefox on Windows')).not.toBeInTheDocument();
    expect(onRevoked).toHaveBeenCalledWith({ id: 'other', current: false });
    const deleted = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE');
    expect(String(deleted?.[0])).toBe('http://localhost:8100/account/sessions/other');
    expect(new Headers((deleted?.[1] as RequestInit).headers).get('Authorization')).toBe('Bearer super-secret');
  });

  it('signs out every other session and keeps this device', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return httpResponse(204);
      return httpResponse(200, sessions);
    });
    renderSessions();

    await user.click(await screen.findByRole('button', { name: 'Sign out all other sessions' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out all other sessions?' });
    expect(within(dialog).getByText(/This device stays signed in/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Sign out other sessions' }));

    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.queryByText('Firefox on Windows')).not.toBeInTheDocument();
    expect(screen.queryByText(/192\.0\.2\.1/)).not.toBeInTheDocument();
    const deleted = fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE');
    expect(deleted).toHaveLength(3);
    expect(deleted.map((call) => String(call[0]))).not.toContain('http://localhost:8100/account/sessions/here');
  });

  it('shows a loading state, then an error with retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    fetchMock.mockImplementation(async () => {
      if (fail) return httpResponse(500, { message: 'nope' });
      return httpResponse(200, []);
    });
    renderSessions();

    expect(screen.getByRole('status', { name: 'Loading sessions' })).toBeInTheDocument();
    expect(await screen.findByText('Unable to load sessions.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No sessions.')).toBeInTheDocument();
  });
});
