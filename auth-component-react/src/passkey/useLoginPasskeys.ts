import { useEffect, useRef, useState } from 'react';
import { passkeysSupported, type AccountClient } from '@posadskiy/account-client';
import type { AuthResponse } from '../types';
import { resolveLinkOrigin } from '../linkOrigin';
import {
  authenticateWithPasskey,
  createPasskey,
  isSilentPasskeyError,
  passkeyCapabilities,
} from './ceremony';

function toAuthResponse(session: { accessToken: string; expiresIn: number; userId: string | null }): AuthResponse {
  return {
    access_token: session.accessToken,
    expires_in: session.expiresIn,
    ...(session.userId ? { userId: session.userId } : {}),
  };
}

/**
 * Passkey autofill on the login form, a passkey button, silent creation after a password
 * login, and an explicit prompt when that creation does not happen.
 * Active only when `enabled` is set and an account client is available.
 */
export function useLoginPasskeys(input: {
  enabled: boolean;
  client?: AccountClient;
  linkOrigin?: string;
  onSuccess?: (response: AuthResponse) => void;
  onError?: (error: Error) => void;
  signInFailed: string;
  createFailed: string;
}) {
  const supported = input.enabled && passkeysSupported();
  const [prompt, setPrompt] = useState<AuthResponse | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptPending, setPromptPending] = useState(false);
  const [autofillEpoch, setAutofillEpoch] = useState(0);
  const clientRef = useRef(input.client);
  const onSuccessRef = useRef(input.onSuccess);
  const onErrorRef = useRef(input.onError);
  const linkOriginRef = useRef(input.linkOrigin);
  const signInFailedRef = useRef(input.signInFailed);
  const createFailedRef = useRef(input.createFailed);
  const completedRef = useRef(false);
  const suppressRef = useRef(false);
  const mountedRef = useRef(true);
  const autofillAbortRef = useRef<AbortController | null>(null);
  clientRef.current = input.client;
  onSuccessRef.current = input.onSuccess;
  onErrorRef.current = input.onError;
  linkOriginRef.current = input.linkOrigin;
  signInFailedRef.current = input.signInFailed;
  createFailedRef.current = input.createFailed;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const finish = (response: AuthResponse) => {
    if (!mountedRef.current || completedRef.current) return;
    completedRef.current = true;
    autofillAbortRef.current?.abort();
    setPrompt(null);
    onSuccessRef.current?.(response);
  };

  useEffect(() => {
    const client = clientRef.current;
    if (!supported || !client || prompt) return;
    const controller = new AbortController();
    autofillAbortRef.current = controller;
    let ignore = false;
    void (async () => {
      const caps = await passkeyCapabilities();
      if (ignore || controller.signal.aborted || suppressRef.current || !caps.conditionalGet) return;
      try {
        const session = await authenticateWithPasskey(client, resolveLinkOrigin(linkOriginRef.current), {
          mediation: 'conditional',
          signal: controller.signal,
        });
        if (ignore || suppressRef.current || completedRef.current) return;
        finish(toAuthResponse(session));
      } catch {
        // Autofill stays quiet when the user picks a password or dismisses the suggestion.
      }
    })();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [supported, prompt, autofillEpoch]);

  const beginPasswordAttempt = () => {
    suppressRef.current = true;
    autofillAbortRef.current?.abort();
  };

  const passwordAttemptFailed = () => {
    suppressRef.current = false;
    setAutofillEpoch((epoch) => epoch + 1);
  };

  const afterPasswordLogin = async (response: AuthResponse) => {
    const client = clientRef.current;
    if (!supported || !client || completedRef.current) {
      finish(response);
      return;
    }
    try {
      const existing = await client.listPasskeys();
      if (Array.isArray(existing) && existing.length > 0) {
        finish(response);
        return;
      }
      const caps = await passkeyCapabilities();
      if (caps.conditionalCreate) {
        try {
          await createPasskey(client, { mediation: 'conditional' });
          finish(response);
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'InvalidStateError') {
            finish(response);
            return;
          }
        }
      }
    } catch {
      finish(response);
      return;
    }
    if (!mountedRef.current || completedRef.current) return;
    setPromptError(null);
    setPrompt(response);
  };

  const signInWithPasskey = async (): Promise<'done' | 'cancelled' | 'failed'> => {
    const client = clientRef.current;
    if (!supported || !client || completedRef.current) return 'cancelled';
    suppressRef.current = true;
    autofillAbortRef.current?.abort();
    try {
      const session = await authenticateWithPasskey(client, resolveLinkOrigin(linkOriginRef.current));
      finish(toAuthResponse(session));
      return 'done';
    } catch (caught) {
      suppressRef.current = false;
      setAutofillEpoch((epoch) => epoch + 1);
      if (isSilentPasskeyError(caught)) return 'cancelled';
      onErrorRef.current?.(caught instanceof Error ? caught : new Error(signInFailedRef.current));
      return 'failed';
    }
  };

  const createFromPrompt = async () => {
    const client = clientRef.current;
    const pending = prompt;
    if (!client || !pending || promptPending) return;
    setPromptPending(true);
    setPromptError(null);
    try {
      await createPasskey(client);
      finish(pending);
    } catch (caught) {
      if (!isSilentPasskeyError(caught)) {
        const error = caught instanceof Error ? caught : new Error(createFailedRef.current);
        onErrorRef.current?.(error);
        setPromptError(createFailedRef.current);
      }
    } finally {
      setPromptPending(false);
    }
  };

  const dismissPrompt = () => {
    if (prompt) finish(prompt);
  };

  return {
    supported,
    emailAutoComplete: supported ? 'username webauthn' : 'email',
    prompt,
    promptError,
    promptPending,
    beginPasswordAttempt,
    passwordAttemptFailed,
    afterPasswordLogin,
    signInWithPasskey,
    createFromPrompt,
    dismissPrompt,
  };
}
