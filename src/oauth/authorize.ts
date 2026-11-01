import { navigation } from '../navigation';
import { browserRegion, type BrowserRegion } from '../region';
import type { OAuthProvider } from '../types';
import { createPkceVerifier, pkceChallenge, rememberPkceVerifier } from './pkce';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertSafeAuthorizationUri(uri: string, allowedHosts?: string[]): URL {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('OAuth provider returned an invalid authorization URL.');
  }

  const hostname = url.hostname.toLowerCase();
  const isLocal = LOCAL_HOSTS.has(hostname);
  const https = url.protocol === 'https:';
  const localHttp = url.protocol === 'http:' && isLocal;

  if (!https && !localHttp) {
    throw new Error('OAuth authorization URL must use HTTPS.');
  }

  if (allowedHosts && allowedHosts.length > 0) {
    const allowed = new Set(allowedHosts.map((host) => host.toLowerCase()));
    if (!allowed.has(hostname)) {
      throw new Error('OAuth authorization URL host is not allowed.');
    }
  }

  return url;
}

export function buildAuthorizeUrl(
  oauthApiUrl: string,
  provider: OAuthProvider,
  returnTo: string,
  codeChallenge: string,
  region: BrowserRegion = {},
): string {
  const base = oauthApiUrl.replace(/\/$/, '');
  const url = new URL(`${base}/oauth2/authorize/${provider}`);
  url.searchParams.set('return_to', returnTo);
  url.searchParams.set('code_challenge', codeChallenge);
  if (region.locale) url.searchParams.set('locale', region.locale);
  if (region.timeZone) url.searchParams.set('time_zone', region.timeZone);
  return url.toString();
}

export function resolveOAuthReturnTo(returnTo?: string, allowedReturnToHosts?: string[]): string {
  const current = `${window.location.origin}${window.location.pathname}`;
  if (!returnTo) return current;

  let url: URL;
  try {
    url = new URL(returnTo, window.location.origin);
  } catch {
    throw new Error('OAuth return URL is invalid.');
  }

  if (url.origin === window.location.origin) return url.toString();

  // Entries that contain :// are exact return URLs, including app schemes such as costy://oauth/callback.
  const exactReturnUrls = new Set(
    (allowedReturnToHosts ?? []).filter((entry) => entry.includes('://')).map((entry) => entry.toLowerCase()),
  );
  if (exactReturnUrls.has(url.href.toLowerCase())) return url.href;

  const hostname = url.hostname.toLowerCase();
  const isLocal = LOCAL_HOSTS.has(hostname);
  const https = url.protocol === 'https:';
  const localHttp = url.protocol === 'http:' && isLocal;
  if (!https && !localHttp) {
    throw new Error('OAuth return URL must use HTTPS.');
  }

  const allowed = new Set((allowedReturnToHosts ?? []).map((host) => host.toLowerCase()));
  if (!allowed.has(hostname)) {
    throw new Error('OAuth return URL host is not allowed.');
  }

  return url.toString();
}

export async function beginOAuthAuthorization(options: {
  provider: OAuthProvider;
  oauthApiUrl?: string;
  oauthReturnTo?: string;
  allowedOAuthHosts?: string[];
  allowedReturnToHosts?: string[];
}): Promise<void> {
  const { provider, oauthApiUrl, oauthReturnTo, allowedOAuthHosts, allowedReturnToHosts } = options;

  if (!oauthApiUrl) {
    throw new Error('oauthApiUrl must be provided for OAuth');
  }

  const verifier = createPkceVerifier();
  const challenge = await pkceChallenge(verifier);
  const url = buildAuthorizeUrl(
    oauthApiUrl,
    provider,
    resolveOAuthReturnTo(oauthReturnTo, allowedReturnToHosts),
    challenge,
    browserRegion(),
  );
  assertSafeAuthorizationUri(url, allowedOAuthHosts);
  rememberPkceVerifier(verifier);
  navigation.assign(url);
}
