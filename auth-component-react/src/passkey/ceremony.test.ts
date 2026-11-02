import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSilentPasskeyError, passkeyCapabilities } from './ceremony';

describe('passkey ceremony helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks common WebAuthn dismissals as silent', () => {
    for (const name of ['NotAllowedError', 'AbortError', 'InvalidStateError', 'NotSupportedError']) {
      expect(isSilentPasskeyError(Object.assign(new Error(name), { name }))).toBe(true);
    }
    expect(isSilentPasskeyError(new Error('Passkey sign-in was cancelled.'))).toBe(true);
    expect(isSilentPasskeyError(new Error('network down'))).toBe(false);
  });

  it('reads conditional get and create from client capabilities', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => ({
        conditionalGet: true,
        conditionalCreate: true,
      }),
    });

    await expect(passkeyCapabilities()).resolves.toEqual({
      conditionalGet: true,
      conditionalCreate: true,
    });
  });

  it('falls back when client capabilities are missing', async () => {
    vi.stubGlobal('PublicKeyCredential', {});
    await expect(passkeyCapabilities()).resolves.toEqual({
      conditionalGet: false,
      conditionalCreate: false,
    });
  });
});
