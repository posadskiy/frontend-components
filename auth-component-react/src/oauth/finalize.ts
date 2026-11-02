import axios from 'axios';
import type { OAuthTokenResponse } from '../types';
import { isOAuthTokenResponse } from '../validate';
import { clearPkceVerifier, readPkceVerifier } from './pkce';

type Inflight = {
  controller: AbortController;
  promise: Promise<OAuthTokenResponse>;
  subscribers: number;
};

const inflight = new Map<string, Inflight>();

export function subscribeFinalize(oauthApiUrl: string, code: string): {
  promise: Promise<OAuthTokenResponse>;
  unsubscribe: () => void;
} {
  const base = oauthApiUrl.replace(/\/$/, '');
  const key = `${base}\n${code}`;
  let entry = inflight.get(key);

  if (!entry) {
    const controller = new AbortController();
    const promise = axios
      .post<OAuthTokenResponse>(
        `${base}/oauth2/finalize`,
        { code, codeVerifier: readPkceVerifier() },
        { signal: controller.signal, withCredentials: true },
      )
      .then((response) => {
        clearPkceVerifier();
        if (!isOAuthTokenResponse(response.data)) {
          throw new Error('The auth service returned an unexpected response.');
        }
        // A native app receives refresh_token here. OAuthCallback hands it to the account
        // client and strips it before onSuccess.
        return response.data;
      });

    entry = { controller, promise, subscribers: 0 };
    inflight.set(key, entry);

    void promise.then(
      () => {
        if (inflight.get(key) === entry) inflight.delete(key);
      },
      () => {
        if (inflight.get(key) === entry) inflight.delete(key);
      },
    );
  }

  entry.subscribers += 1;
  const current = entry;
  let released = false;

  return {
    promise: current.promise,
    unsubscribe: () => {
      if (released) return;
      released = true;
      current.subscribers -= 1;
      queueMicrotask(() => {
        if (current.subscribers <= 0 && inflight.get(key) === current) {
          current.controller.abort();
          inflight.delete(key);
        }
      });
    },
  };
}

export function resetOAuthFinalizeForTests() {
  Array.from(inflight.values()).forEach((entry) => {
    entry.controller.abort();
  });
  inflight.clear();
}
