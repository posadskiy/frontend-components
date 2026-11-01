import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { CaptchaTokens } from './tokens';
import { TurnstileWidget } from './TurnstileWidget';

const captchaWaitMs = 8000;

export function useTurnstile(
  siteKey: string | undefined,
  incompleteMessage: string,
  failureMessage: string,
): { widget: ReactNode; getCaptchaToken?: () => Promise<string | undefined> } {
  const configured = siteKey?.trim() ?? '';
  const tokens = useRef(new CaptchaTokens());
  const widgetRef = useRef<{ reset: () => void } | null>(null);
  const onToken = useCallback((token: string) => tokens.current.set(token), []);
  const onClear = useCallback(() => tokens.current.clear(), []);
  const onWidget = useCallback((next: { reset: () => void }) => {
    widgetRef.current = next;
  }, []);

  const getCaptchaToken = useCallback(async () => {
    const token = await tokens.current.take(captchaWaitMs);
    if (!token) throw new Error(incompleteMessage);
    widgetRef.current?.reset();
    return token;
  }, [incompleteMessage]);

  const widget = useMemo(
    () =>
      configured ? (
        <TurnstileWidget
          siteKey={configured}
          failureMessage={failureMessage}
          onToken={onToken}
          onClear={onClear}
          onWidget={onWidget}
        />
      ) : null,
    [configured, failureMessage, onClear, onToken, onWidget],
  );

  if (!configured) return { widget: null };
  return { widget, getCaptchaToken };
}
