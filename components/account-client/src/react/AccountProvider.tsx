import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import type { AccountClient } from '../client.js';
import type { SessionSnapshot } from '../session.js';

const AccountContext = createContext<AccountClient | null>(null);

export function AccountProvider({ client, children }: { client: AccountClient; children: ReactNode }) {
  return <AccountContext.Provider value={client}>{children}</AccountContext.Provider>;
}

export function useAccountClient(): AccountClient {
  const client = useContext(AccountContext);
  if (!client) throw new Error('useAccountClient must be used within AccountProvider');
  return client;
}

export function useOptionalAccountClient(): AccountClient | null {
  return useContext(AccountContext);
}

export function useSession(): SessionSnapshot {
  const client = useAccountClient();
  return useSyncExternalStore(client.session.subscribe, client.session.snapshot, client.session.snapshot);
}

export function RequireAuth({
  children,
  fallback = null,
  pending = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  pending?: ReactNode;
}) {
  const client = useAccountClient();
  const session = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void client.ensureFresh().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [client]);

  if (!ready) return pending;
  if (!session.accessToken) return fallback;
  return children;
}
