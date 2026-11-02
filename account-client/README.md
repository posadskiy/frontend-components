# @posadskiy/account-client

Browser session client for auth-service and user-service.

The access token stays in memory. The refresh token stays in the httpOnly cookie that auth-service sets for browser requests. This package never writes that cookie. In a browser it never sends `refresh_token` in a request body (see Native apps below).

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

Use `acceptTokens(body)` for a token response fetched outside the client, such as an OAuth finalize call.

## Native apps

auth-service treats a request without `Sec-Fetch-*` headers as native. It sends no cookie and returns `refresh_token` in the JSON body. A Capacitor app with `CapacitorHttp` enabled looks native, because its requests go through iOS networking.

Pass a `refreshTokenStore` backed by the Keychain (or the platform equivalent) in that case:

```ts
const client = new AccountClient({
  authUrl,
  userUrl,
  refreshTokenStore: Capacitor.isNativePlatform() ? keychainStore : undefined,
});
```

With a store, the client saves `refresh_token` from every token response, sends it in the body of `/oauth/token` and `/logout`, and clears it when auth-service rejects it or on logout. Do not set a store in a browser: auth-service rejects a body token from a browser.
