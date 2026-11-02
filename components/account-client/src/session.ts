export interface SessionSnapshot {
  accessToken: string | null;
  userId: string | null;
  /** Epoch milliseconds. Null means the access token has no known expiry. */
  expiresAt: number | null;
}

export const emptySession = (): SessionSnapshot => ({
  accessToken: null,
  userId: null,
  expiresAt: null,
});

/**
 * Access token only. The refresh token is an httpOnly cookie set by auth-service
 * and is never written here.
 */
export class AccountSession {
  private listeners = new Set<() => void>();
  private current: SessionSnapshot = emptySession();

  snapshot = (): SessionSnapshot => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  replace(next: SessionSnapshot) {
    if (
      this.current.accessToken === next.accessToken &&
      this.current.userId === next.userId &&
      this.current.expiresAt === next.expiresAt
    ) {
      return;
    }
    this.current = next;
    for (const listener of this.listeners) listener();
  }

  clear() {
    this.replace(emptySession());
  }

  adopt(accessToken: string, expiresIn: number | null, userId: string | null) {
    const expiresAt =
      expiresIn != null && Number.isFinite(expiresIn) ? Date.now() + expiresIn * 1000 : null;
    this.replace({ accessToken, userId, expiresAt });
  }
}
