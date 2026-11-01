import { useEffect, useRef, useState } from 'react';
import { Text } from '@mantine/core';

const scriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Captcha could not be loaded'));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Captcha could not be loaded')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Captcha could not be loaded')), { once: true });
    document.head.appendChild(script);
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export function TurnstileWidget({
  siteKey,
  failureMessage,
  onToken,
  onClear,
  onWidget,
}: {
  siteKey: string;
  failureMessage: string;
  onToken: (token: string) => void;
  onClear: () => void;
  onWidget: (widget: { reset: () => void }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let removed = false;
    let widgetId: string | null = null;
    let api: TurnstileApi | null = null;

    void loadTurnstile()
      .then((turnstile) => {
        if (removed || !container.current) return;
        api = turnstile;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onClear(),
          'error-callback': () => {
            onClear();
            setFailed(true);
          },
        });
        onWidget({
          reset: () => {
            if (widgetId) api?.reset(widgetId);
          },
        });
      })
      .catch(() => {
        if (!removed) setFailed(true);
      });

    return () => {
      removed = true;
      if (widgetId) api?.remove(widgetId);
    };
  }, [onClear, onToken, onWidget, siteKey]);

  return (
    <div>
      <div ref={container} style={{ minHeight: 65 }} />
      {failed ? (
        <Text size="sm" c="dimmed">
          {failureMessage}
        </Text>
      ) : null}
    </div>
  );
}
