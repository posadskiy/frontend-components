/** HTTP(S) origin with no userinfo, path, query, or hash. `https://grammarbar.com` is valid. */
export function resolveLinkOrigin(explicit?: string): string {
  const candidate = (explicit ?? (typeof window === 'undefined' ? '' : window.location.origin)).trim();
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('linkOrigin must be a site origin, such as https://grammarbar.com');
  }

  const http = url.protocol === 'https:' || url.protocol === 'http:';
  const originOnly = !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  if (!http || !originOnly) {
    throw new Error('linkOrigin must be a site origin, such as https://grammarbar.com');
  }

  return url.origin;
}

/**
 * Base URL for `/account/*`. An explicit account URL wins; otherwise `apiUrl` is used.
 * A trailing `/login` or `/signup` is removed. A service prefix such as `/auth` stays.
 */
export function resolveAccountOrigin(accountApiUrl?: string, apiUrl?: string): string {
  const source = accountApiUrl?.trim() || apiUrl?.trim();
  if (!source) {
    throw new Error('Either accountApiUrl or apiUrl must be provided');
  }

  let url: URL;
  try {
    url = new URL(source, typeof window === 'undefined' ? undefined : window.location.origin);
  } catch {
    throw new Error('Account API URL must use HTTP or HTTPS');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Account API URL must use HTTP or HTTPS');
  }

  const path = url.pathname.replace(/\/+$/, '').replace(/\/(login|signup)$/, '');
  return `${url.origin}${path === '/' ? '' : path}`;
}

export function accountEndpoint(origin: string, path: '/account/forgot-password' | '/account/reset-password'): string {
  return `${origin}${path}`;
}
