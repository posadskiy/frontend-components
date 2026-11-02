export class AccountHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(readMessage(body) ?? `Request failed (${status})`);
    this.name = 'AccountHttpError';
    this.status = status;
    this.body = body;
  }
}

export function readMessage(body: unknown): string | undefined {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  for (const key of ['message', 'detail', 'error_description', 'error']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
