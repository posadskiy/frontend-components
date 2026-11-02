import { describe, expect, it } from 'vitest';
import { toCreationOptions, toRequestOptions } from './passkey.js';

const challenge = 'AQID';

describe('passkey ceremony options', () => {
  it('reads a challenge that was nested inside a second publicKey object', () => {
    const created = toCreationOptions({
      publicKey: {
        challenge,
        user: { id: challenge, name: 'ada@example.com', displayName: 'ada@example.com' },
        excludeCredentials: [],
      },
    });
    expect(created.challenge.byteLength).toBeGreaterThan(0);
    expect(new Uint8Array(created.user.id)).toEqual(new Uint8Array(created.challenge));

    const requested = toRequestOptions({
      publicKey: { challenge, allowCredentials: [{ id: challenge, type: 'public-key' }] },
    });
    expect(requested.challenge.byteLength).toBeGreaterThan(0);
    expect(requested.allowCredentials?.[0]?.id.byteLength).toBeGreaterThan(0);
  });
});
