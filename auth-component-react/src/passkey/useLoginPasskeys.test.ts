import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountClient } from '@posadskiy/account-client';
import { useLoginPasskeys } from './useLoginPasskeys';

const authenticateWithPasskey = vi.fn();
const createPasskey = vi.fn();
const passkeyCapabilities = vi.fn();
const isSilentPasskeyError = vi.fn();

vi.mock('@posadskiy/account-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@posadskiy/account-client')>();
  return {
    ...actual,
    passkeysSupported: () => true,
  };
});

vi.mock('./ceremony', () => ({
  authenticateWithPasskey: (...args: unknown[]) => authenticateWithPasskey(...args),
  createPasskey: (...args: unknown[]) => createPasskey(...args),
  passkeyCapabilities: (...args: unknown[]) => passkeyCapabilities(...args),
  isSilentPasskeyError: (...args: unknown[]) => isSilentPasskeyError(...args),
}));

const session = { accessToken: 'access', expiresIn: 3600, userId: 'user-1' };
const passwordLogin = { access_token: 'access', expires_in: 3600, userId: 'user-1' };

function client(listPasskeys: AccountClient['listPasskeys'] = vi.fn().mockResolvedValue([])): AccountClient {
  return { listPasskeys } as unknown as AccountClient;
}

function renderPasskeys(overrides: Partial<Parameters<typeof useLoginPasskeys>[0]> = {}) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const account = overrides.client ?? client();
  const hook = renderHook(() =>
    useLoginPasskeys({
      enabled: true,
      client: account,
      onSuccess,
      onError,
      signInFailed: 'Passkey sign-in failed',
      createFailed: 'Passkey create failed',
      ...overrides,
    }),
  );
  return { ...hook, onSuccess, onError, account };
}

describe('useLoginPasskeys', () => {
  beforeEach(() => {
    authenticateWithPasskey.mockReset();
    createPasskey.mockReset();
    passkeyCapabilities.mockReset();
    isSilentPasskeyError.mockReset();
    passkeyCapabilities.mockResolvedValue({ conditionalGet: false, conditionalCreate: false });
    isSilentPasskeyError.mockReturnValue(false);
  });

  it('marks the email field for passkey autofill when enabled', () => {
    const { result } = renderPasskeys();
    expect(result.current.supported).toBe(true);
    expect(result.current.emailAutoComplete).toBe('username webauthn');
  });

  it('signs in through conditional autofill', async () => {
    passkeyCapabilities.mockResolvedValue({ conditionalGet: true, conditionalCreate: false });
    authenticateWithPasskey.mockResolvedValue(session);
    const { onSuccess } = renderPasskeys();

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({
        access_token: 'access',
        expires_in: 3600,
        userId: 'user-1',
      }),
    );
    expect(authenticateWithPasskey).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ mediation: 'conditional' }),
    );
  });

  it('skips the create prompt when the account already has a passkey', async () => {
    const { result, onSuccess } = renderPasskeys({
      client: client(vi.fn().mockResolvedValue([{ id: 'key-1' }])),
    });

    await act(async () => {
      await result.current.afterPasswordLogin(passwordLogin);
    });

    expect(createPasskey).not.toHaveBeenCalled();
    expect(result.current.prompt).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith(passwordLogin);
  });

  it('creates a passkey silently after password login when the browser supports it', async () => {
    passkeyCapabilities.mockResolvedValue({ conditionalGet: false, conditionalCreate: true });
    createPasskey.mockResolvedValue(undefined);
    const { result, onSuccess } = renderPasskeys();

    await act(async () => {
      await result.current.afterPasswordLogin(passwordLogin);
    });

    expect(createPasskey).toHaveBeenCalledWith(expect.anything(), { mediation: 'conditional' });
    expect(result.current.prompt).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith(passwordLogin);
  });

  it('offers an explicit create prompt when silent creation is unavailable', async () => {
    const { result, onSuccess } = renderPasskeys();

    await act(async () => {
      await result.current.afterPasswordLogin(passwordLogin);
    });

    expect(result.current.prompt).toEqual(passwordLogin);
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      result.current.dismissPrompt();
    });

    expect(onSuccess).toHaveBeenCalledWith(passwordLogin);
    expect(result.current.prompt).toBeNull();
  });

  it('creates a passkey from the prompt and then finishes login', async () => {
    createPasskey.mockResolvedValue(undefined);
    const { result, onSuccess } = renderPasskeys();

    await act(async () => {
      await result.current.afterPasswordLogin(passwordLogin);
    });
    await act(async () => {
      await result.current.createFromPrompt();
    });

    expect(createPasskey).toHaveBeenCalledWith(expect.anything());
    expect(onSuccess).toHaveBeenCalledWith(passwordLogin);
  });

  it('signs in with the passkey button', async () => {
    authenticateWithPasskey.mockResolvedValue(session);
    const { result, onSuccess } = renderPasskeys();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signInWithPasskey();
    });

    expect(outcome).toBe('done');
    expect(onSuccess).toHaveBeenCalledWith({
      access_token: 'access',
      expires_in: 3600,
      userId: 'user-1',
    });
  });

  it('treats a cancelled passkey button ceremony as cancelled', async () => {
    const cancelled = Object.assign(new Error('cancelled'), { name: 'NotAllowedError' });
    authenticateWithPasskey.mockRejectedValue(cancelled);
    isSilentPasskeyError.mockReturnValue(true);
    const { result, onSuccess, onError } = renderPasskeys();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signInWithPasskey();
    });

    expect(outcome).toBe('cancelled');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a failed passkey button ceremony', async () => {
    authenticateWithPasskey.mockRejectedValue(new Error('network'));
    const { result, onError } = renderPasskeys();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signInWithPasskey();
    });

    expect(outcome).toBe('failed');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
