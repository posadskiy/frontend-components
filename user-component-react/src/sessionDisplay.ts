import type { AccountSessionInfo } from '@posadskiy/account-client';

export type DeviceKind = 'phone' | 'computer' | 'unknown';

export interface SessionView {
  id: string;
  /** Null when the session has no device or provider name. */
  title: string | null;
  /** Set only when the title is already a device, so the provider stays a separate badge. */
  provider: string | null;
  meta: string | null;
  current: boolean;
  kind: DeviceKind;
}

const providerNames: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
  microsoft: 'Microsoft',
  github: 'GitHub',
  discord: 'Discord',
  password: 'Password',
  local: 'Password',
  email: 'Password',
};

export function providerName(provider: string | null | undefined): string | null {
  const value = provider?.trim();
  if (!value) return null;
  return providerNames[value.toLowerCase()] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function browserName(userAgent: string): string | null {
  if (/Edg(?:e|A|iOS)?\//.test(userAgent)) return 'Edge';
  if (/OPR\/|Opera/.test(userAgent)) return 'Opera';
  if (/SamsungBrowser\//.test(userAgent)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return 'Safari';
  return null;
}

export function osName(userAgent: string): string | null {
  if (/iPad/.test(userAgent)) return 'iPadOS';
  if (/iPhone|iPod/.test(userAgent)) return 'iOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/CrOS/.test(userAgent)) return 'ChromeOS';
  if (/Windows NT/.test(userAgent)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  return null;
}

export function deviceTitle(userAgent: string | null | undefined): string | null {
  const ua = userAgent?.trim();
  if (!ua) return null;
  const browser = browserName(ua);
  const os = osName(ua);
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
}

export function deviceKind(userAgent: string | null | undefined): DeviceKind {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return 'unknown';
  if (/iPad/.test(ua)) return 'computer';
  if (/iPhone|iPod/.test(ua)) return 'phone';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'phone';
  return osName(ua) ? 'computer' : 'unknown';
}

export function signedInLabel(createdAt: string | null | undefined, now = Date.now()): string | null {
  if (!createdAt) return null;
  const then = Date.parse(createdAt);
  if (!Number.isFinite(then)) return null;
  const elapsed = now - then;
  if (elapsed < 60_000) return 'Signed in just now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Signed in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Signed in ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Signed in yesterday';
  if (days < 30) return `Signed in ${days} days ago`;
  return `Signed in ${new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function sessionIdFromAccessToken(token: string | null | undefined): string | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = JSON.parse(atob(padded + pad)) as Record<string, unknown>;
    for (const key of ['sid', 'session_id', 'sessionId', 'family_id', 'familyId']) {
      const value = json[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveCurrentSessionId(
  sessions: Pick<AccountSessionInfo, 'id' | 'userAgent'>[],
  options: { explicitId?: string | null; accessToken?: string | null; navigatorUserAgent?: string | null },
): string | null {
  const ids = new Set(sessions.map((session) => session.id));
  const explicit = options.explicitId?.trim();
  if (explicit && ids.has(explicit)) return explicit;
  const fromToken = sessionIdFromAccessToken(options.accessToken);
  if (fromToken && ids.has(fromToken)) return fromToken;
  const ua = options.navigatorUserAgent?.trim();
  if (!ua) return null;
  const matches = sessions.filter((session) => session.userAgent?.trim() === ua);
  return matches.length === 1 ? matches[0].id : null;
}

function ordered<T extends Pick<AccountSessionInfo, 'id' | 'createdAt'>>(sessions: T[], currentId: string | null): T[] {
  return [...sessions].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    const aTime = Date.parse(a.createdAt ?? '');
    const bTime = Date.parse(b.createdAt ?? '');
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

export function presentSessions(
  sessions: AccountSessionInfo[],
  currentId: string | null,
  now = Date.now(),
): SessionView[] {
  const views = ordered(sessions, currentId).map((session) => {
    const device = deviceTitle(session.userAgent);
    const provider = providerName(session.provider);
    const parts = [signedInLabel(session.createdAt, now), session.clientIp?.trim() || null].filter(
      (part): part is string => Boolean(part),
    );
    return {
      id: session.id,
      title: device ?? provider,
      provider: device ? provider : null,
      meta: parts.length > 0 ? parts.join(' · ') : null,
      current: session.id === currentId,
      kind: deviceKind(session.userAgent),
    };
  });

  const counts = new Map<string, number>();
  for (const view of views) {
    const key = `${view.title ?? ''}\n${view.meta ?? ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return views.map((view) => {
    const key = `${view.title ?? ''}\n${view.meta ?? ''}`;
    if ((counts.get(key) ?? 0) < 2) return view;
    const suffix = `ID ${view.id.slice(0, 8)}`;
    return { ...view, meta: view.meta ? `${view.meta} · ${suffix}` : suffix };
  });
}
