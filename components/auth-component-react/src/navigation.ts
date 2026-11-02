export function safeAppPath(path: string | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')) return path;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function stripOAuthQuery(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

export function stripResetToken(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('token');
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

export const navigation = {
  assign(url: string) {
    window.location.assign(url);
  },
  replacePath(path: string) {
    window.history.replaceState({}, '', path);
  },
};
