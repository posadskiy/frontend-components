import { AccountClient } from '@posadskiy/account-client';
import type { AccountIdentity, AccountPasskey, AccountSessionInfo } from '@posadskiy/account-client';

export type AccountSession = AccountSessionInfo;
export type { AccountIdentity, AccountPasskey };

function clientFor(apiUrl: string, token: string): AccountClient {
  const client = new AccountClient({ authUrl: apiUrl });
  const accessToken = token.trim();
  if (accessToken) client.session.adopt(accessToken, null, null);
  return client;
}

export async function listSessions(apiUrl: string, token: string): Promise<AccountSession[]> {
  return clientFor(apiUrl, token).listSessions();
}

export async function revokeSession(apiUrl: string, token: string, id: string): Promise<void> {
  await clientFor(apiUrl, token).revokeSession(id);
}

export async function changePassword(apiUrl: string, token: string, currentPassword: string, password: string): Promise<void> {
  await clientFor(apiUrl, token).changePassword(currentPassword, password);
}

export async function setPassword(apiUrl: string, token: string, password: string): Promise<void> {
  await clientFor(apiUrl, token).setPassword(password);
}

export async function changeEmail(
  apiUrl: string,
  token: string,
  email: string,
  linkOrigin: string,
  password?: string,
): Promise<void> {
  await clientFor(apiUrl, token).changeEmail(email, linkOrigin, password);
}

export async function listIdentities(apiUrl: string, token: string): Promise<AccountIdentity[]> {
  return clientFor(apiUrl, token).listIdentities();
}

export async function unlinkIdentity(apiUrl: string, token: string, provider: string): Promise<void> {
  await clientFor(apiUrl, token).unlinkIdentity(provider);
}

export async function listPasskeys(apiUrl: string, token: string): Promise<AccountPasskey[]> {
  return clientFor(apiUrl, token).listPasskeys();
}

export async function deletePasskey(apiUrl: string, token: string, id: string): Promise<void> {
  await clientFor(apiUrl, token).deletePasskey(id);
}

export async function exportAccount(apiUrl: string, token: string): Promise<unknown> {
  return clientFor(apiUrl, token).exportAccount();
}

export async function eraseAccount(apiUrl: string, token: string, confirmation: string, password?: string): Promise<void> {
  await clientFor(apiUrl, token).eraseAccount(confirmation, password);
}
