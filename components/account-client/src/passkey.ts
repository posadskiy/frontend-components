import type { AccountClient } from './client.js';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function cloneBuffer(value: unknown): ArrayBuffer | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return base64UrlToBytes(value).buffer;
}

/**
 * Auth-service returns the WebAuthn options as `publicKey`. Older responses nested that object
 * again, because the library JSON is already `{ publicKey: options }`.
 */
function ceremonyOptions(publicKey: Record<string, unknown>): Record<string, unknown> {
  const nested = publicKey.publicKey;
  if (typeof publicKey.challenge !== 'string' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return publicKey;
}

/** Turns auth-service publicKey JSON into the options the browser ceremony expects. */
export function toCreationOptions(publicKey: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const options = ceremonyOptions(publicKey);
  const user = (options.user ?? {}) as Record<string, unknown>;
  const exclude = Array.isArray(options.excludeCredentials) ? options.excludeCredentials : [];
  return {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: cloneBuffer(options.challenge) ?? new ArrayBuffer(0),
    user: {
      ...(user as unknown as PublicKeyCredentialUserEntity),
      id: cloneBuffer(user.id) ?? new ArrayBuffer(0),
    },
    excludeCredentials: exclude.map((entry) => {
      const credential = entry as Record<string, unknown>;
      return {
        ...(credential as unknown as PublicKeyCredentialDescriptor),
        id: cloneBuffer(credential.id) ?? new ArrayBuffer(0),
      };
    }),
  };
}

export function toRequestOptions(publicKey: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const options = ceremonyOptions(publicKey);
  const allow = Array.isArray(options.allowCredentials) ? options.allowCredentials : [];
  return {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: cloneBuffer(options.challenge) ?? new ArrayBuffer(0),
    allowCredentials: allow.map((entry) => {
      const credential = entry as Record<string, unknown>;
      return {
        ...(credential as unknown as PublicKeyCredentialDescriptor),
        id: cloneBuffer(credential.id) ?? new ArrayBuffer(0),
      };
    }),
  };
}

export function credentialToJson(credential: Credential): unknown {
  if ('toJSON' in credential && typeof credential.toJSON === 'function') return credential.toJSON();
  const source = credential as PublicKeyCredential;
  const response = source.response;
  if (response instanceof AuthenticatorAttestationResponse) {
    return {
      id: source.id,
      rawId: bytesToBase64Url(new Uint8Array(source.rawId)),
      type: source.type,
      response: {
        clientDataJSON: bytesToBase64Url(new Uint8Array(response.clientDataJSON)),
        attestationObject: bytesToBase64Url(new Uint8Array(response.attestationObject)),
      },
    };
  }
  const assertion = response as AuthenticatorAssertionResponse;
  return {
    id: source.id,
    rawId: bytesToBase64Url(new Uint8Array(source.rawId)),
    type: source.type,
    response: {
      clientDataJSON: bytesToBase64Url(new Uint8Array(assertion.clientDataJSON)),
      authenticatorData: bytesToBase64Url(new Uint8Array(assertion.authenticatorData)),
      signature: bytesToBase64Url(new Uint8Array(assertion.signature)),
      userHandle: assertion.userHandle ? bytesToBase64Url(new Uint8Array(assertion.userHandle)) : undefined,
    },
  };
}

export function passkeysSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.credentials?.create === 'function';
}

export async function registerPasskey(client: AccountClient, label?: string): Promise<void> {
  if (!passkeysSupported()) throw new Error('This browser cannot create a passkey.');
  const ceremony = await client.passkeyOptions();
  const credential = await navigator.credentials.create({ publicKey: toCreationOptions(ceremony.publicKey) });
  if (!credential) throw new Error('Passkey registration was cancelled.');
  await client.finishPasskeyRegistration(ceremony.challengeId, credentialToJson(credential), label);
}

export async function loginWithPasskey(client: AccountClient, email?: string, linkOrigin?: string) {
  if (!passkeysSupported()) throw new Error('This browser cannot use a passkey.');
  const ceremony = await client.passkeyLoginOptions(email);
  const credential = await navigator.credentials.get({ publicKey: toRequestOptions(ceremony.publicKey) });
  if (!credential) throw new Error('Passkey sign-in was cancelled.');
  return client.finishPasskeyLogin(ceremony.challengeId, credentialToJson(credential), linkOrigin);
}
