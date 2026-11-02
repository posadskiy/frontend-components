import {
  credentialToJson,
  passkeysSupported,
  toCreationOptions,
  toRequestOptions,
  type AccountClient,
  type TokenSet,
} from '@posadskiy/account-client';

export interface PasskeyCall {
  mediation?: CredentialMediationRequirement;
  signal?: AbortSignal;
}

export async function passkeyCapabilities(): Promise<{ conditionalGet: boolean; conditionalCreate: boolean }> {
  const api = globalThis.PublicKeyCredential as
    | { getClientCapabilities?: () => Promise<Record<string, boolean | undefined>> }
    | undefined;
  if (!api || typeof api.getClientCapabilities !== 'function') {
    return { conditionalGet: false, conditionalCreate: false };
  }
  try {
    const caps = await api.getClientCapabilities();
    return {
      conditionalGet: Boolean(caps.conditionalGet || caps.conditionalMediation),
      conditionalCreate: Boolean(caps.conditionalCreate),
    };
  } catch {
    return { conditionalGet: false, conditionalCreate: false };
  }
}

export function isSilentPasskeyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (
    error.name === 'NotAllowedError' ||
    error.name === 'AbortError' ||
    error.name === 'InvalidStateError' ||
    error.name === 'NotSupportedError'
  ) {
    return true;
  }
  return error.message === 'Passkey sign-in was cancelled.' || error.message === 'Passkey registration was cancelled.';
}

export async function authenticateWithPasskey(
  client: AccountClient,
  linkOrigin: string | undefined,
  call?: PasskeyCall,
): Promise<TokenSet> {
  if (!passkeysSupported()) throw new Error('This browser cannot use a passkey.');
  const ceremony = await client.passkeyLoginOptions(undefined, call?.signal);
  const credential = await navigator.credentials.get({
    publicKey: toRequestOptions(ceremony.publicKey),
    mediation: call?.mediation,
    signal: call?.signal,
  });
  if (!credential) throw new Error('Passkey sign-in was cancelled.');
  return client.finishPasskeyLogin(ceremony.challengeId, credentialToJson(credential), linkOrigin, call?.signal);
}

export async function createPasskey(client: AccountClient, call?: PasskeyCall): Promise<void> {
  if (!passkeysSupported()) throw new Error('This browser cannot create a passkey.');
  const ceremony = await client.passkeyOptions(call?.signal);
  // Conditional create uses `mediation` on create(); DOM typings still omit it.
  const credential = await navigator.credentials.create({
    publicKey: toCreationOptions(ceremony.publicKey),
    mediation: call?.mediation,
    signal: call?.signal,
  } as CredentialCreationOptions);
  if (!credential) throw new Error('Passkey registration was cancelled.');
  await client.finishPasskeyRegistration(ceremony.challengeId, credentialToJson(credential), undefined, call?.signal);
}
