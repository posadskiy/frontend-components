/** Holds a Turnstile token until the form asks for it. A token is single-use. */
export class CaptchaTokens {
  private token: string | null = null;
  private waiters: Array<(token: string | null) => void> = [];

  set(token: string) {
    const value = token.trim();
    if (!value) return;
    if (this.waiters.length === 0) {
      this.token = value;
      return;
    }
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter(value);
  }

  clear() {
    this.token = null;
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter(null);
  }

  take(timeoutMs: number): Promise<string | null> {
    if (this.token) {
      const token = this.token;
      this.token = null;
      return Promise.resolve(token);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (token: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.waiters = this.waiters.filter((waiter) => waiter !== finish);
        resolve(token);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      this.waiters.push(finish);
    });
  }
}
