const VERIFIER_KEY = 'posadskiy.pkce.verifier';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createPkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function rememberPkceVerifier(verifier: string): void {
  localStorage.setItem(VERIFIER_KEY, verifier);
}

export function readPkceVerifier(): string | null {
  return localStorage.getItem(VERIFIER_KEY);
}

export function clearPkceVerifier(): void {
  localStorage.removeItem(VERIFIER_KEY);
}
