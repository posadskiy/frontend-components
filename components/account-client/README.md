# @posadskiy/account-client

Browser session client for auth-service and user-service.

The access token stays in memory. The refresh token stays in the httpOnly cookie that auth-service sets for browser requests. This package never writes that cookie, and it never sends `refresh_token` in a request body.

```tsx
import { AccountClient } from '@posadskiy/account-client';
import { AccountProvider, RequireAuth, useSession } from '@posadskiy/account-client/react';

const client = new AccountClient({
  authUrl: 'https://api.posadskiy.com/auth',
  userUrl: 'https://api.posadskiy.com/user',
});

function App() {
  return (
    <AccountProvider client={client}>
      <RequireAuth fallback={<p>Sign in</p>}>
        <Home />
      </RequireAuth>
    </AccountProvider>
  );
}

function Home() {
  const session = useSession();
  return <p>{session.userId}</p>;
}
```

`refresh()` posts `{ grant_type: "refresh_token" }` to `/oauth/token` with `credentials: "include"`. Concurrent callers share that request. A 401 on an authenticated call refreshes once and retries once. `logout()` posts to `/logout` with the cookie and clears the memory session even when the request fails.

Native apps that receive `refresh_token` in JSON should keep using their own keychain client. This package is for browsers, including Capacitor web views.
