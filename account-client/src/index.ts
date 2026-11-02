export { AccountHttpError, isAbortError, readMessage } from './errors.js';
export { AccountClient } from './client.js';
export { AccountSession, emptySession } from './session.js';
export type { SessionSnapshot } from './session.js';
export {
  credentialToJson,
  isSilentPasskeyError,
  loginWithPasskey,
  passkeyCapabilities,
  passkeysSupported,
  registerPasskey,
  toCreationOptions,
  toRequestOptions,
} from './passkey.js';
export type { PasskeyCall } from './passkey.js';
export type {
  AccountClientOptions,
  AccountIdentity,
  AccountPasskey,
  AccountSessionInfo,
  PasskeyCeremony,
  RequestSpec,
  TokenSet,
  UserProfile,
} from './types.js';
