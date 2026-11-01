# Auth Component React

React login, registration, and OAuth callback components built with Mantine 9 and TypeScript.

## Installation

```bash
npm install auth-component-react @mantine/core @mantine/hooks react react-dom
```

Import Mantine's stylesheet once in the host application:

```tsx
import '@mantine/core/styles.css';
```

## Usage

```tsx
import { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { Login, Register } from 'auth-component-react';

function App() {
  const [showRegister, setShowRegister] = useState(false);
  const [, setAccessToken] = useState<string | null>(null);

  if (showRegister) {
    return (
      <MantineProvider>
        <Register
          apiUrl="http://localhost:8095/signup"
          oauthApiUrl="http://localhost:8100"
          providers={['apple', 'google']}
          onSuccess={() => setShowRegister(false)}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      </MantineProvider>
    );
  }

  return (
    <MantineProvider>
      <Login
        apiUrl="http://localhost:8100/login"
        oauthApiUrl="http://localhost:8100"
        providers={['apple', 'google']}
        onSuccess={(response) => {
          // Keep the access token in memory. Do not write it to localStorage or sessionStorage.
          setAccessToken(response.access_token);
        }}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    </MantineProvider>
  );
}
```

Password login posts `{ email, password }` to `apiUrl` and expects `{ access_token, expires_in, userId? }`. Hold `access_token` in memory. A refresh token, if you use one, belongs in an httpOnly cookie set by your backend, not in browser storage. Login succeeds while `emailVerified` is false. The access token claim that records that state is `email_verified`. This package does not read the claim, and it does not render a verify-email page.

Registration posts `{ email, password, linkOrigin, locale, timeZone }` to `apiUrl`. `locale` and `timeZone` are taken from the browser and stored only when the account is created. OAuth sends the same values as `locale` and `time_zone` on the authorize request. `linkOrigin` is the site origin only, such as `https://grammarbar.com`, with no path, query, hash, or custom scheme. It defaults to `window.location.origin`. Pass `linkOrigin` when the public origin differs from the page origin. The password must be 10–72 characters and must not match the email. A 201 response with `{ emailVerified: false }` means the account was created. A mail failure still creates the account, so a 201 is success.

OAuth does not derive its base URL from `apiUrl`. Pass `oauthApiUrl`. A provider button navigates the browser to `${oauthApiUrl}/oauth2/authorize/{provider}?return_to=...` so the auth host can set its browser cookie. `oauthReturnTo` is where that host should send the browser back; it receives only `?code=`. A relative return URL stays on the current origin. An absolute return URL on another host is rejected unless that host is listed in `allowedReturnToHosts`. The auth host must be HTTPS, or HTTP on localhost.

### Custom API

```tsx
<Login
  authApi={{
    login: async (email, password) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('Login failed');
      return response.json();
    },
  }}
  onSuccess={(response) => {
    setAccessToken(response.access_token);
  }}
/>
```

### OAuth callback

Mount this on the URL you passed as `oauthReturnTo`. The auth host redirects there with `?code=` after it has checked state. The component posts `{ code, codeVerifier }` to `${oauthApiUrl}/oauth2/finalize` and expects `{ access_token, refresh_token, user_id }`.

```tsx
<OAuthCallback
  oauthApiUrl="http://localhost:8100"
  returnPath="/"
  onSuccess={(tokens) => {
    setAccessToken(tokens.access_token);
  }}
  onError={(error) => {
    console.error(error);
  }}
/>
```

`onSuccess` receives the tokens. The component does not render them. The sample above keeps only the access token in memory. Do not store `refresh_token` in localStorage or sessionStorage. Registration requires a password of 10–72 characters, different from the email, and a matching confirmation. Login and registration both ask for email.

### Forgot password

The login card includes “Forgot password?”. That form posts `{ email, linkOrigin }` to `${accountApiUrl}/account/forgot-password`. `accountApiUrl` defaults to the origin of `apiUrl`, so `http://localhost:8100/login` calls `http://localhost:8100/account/forgot-password`. An unknown email is also 204. The screen always shows “If this account exists, we sent a link.” Too many tries is 429 and shows a rate-limit message. Set `showForgotPassword={false}` to hide the link.

### Reset password

Mount `ResetPassword` on `/reset-password`. The email link contains only `?token=`, and the link lasts 1 hour. The form posts `{ token, password }` to `${accountApiUrl}/account/reset-password`. The new password must be 10–72 characters. 204 calls `onSuccess`; use that to show the login screen. This revokes every refresh token for the account. It does not set `emailVerified`, and it does not log the user in. A bad, used, or expired token is 400 with “Invalid or expired token”.

```tsx
import { ResetPassword } from 'auth-component-react';

<ResetPassword
  accountApiUrl="http://localhost:8100"
  onSuccess={() => {
    window.history.replaceState({}, '', '/');
  }}
/>
```

Email verification, including `/verify-email` and resend, is outside this package. Signup and forgot-password still send `linkOrigin` so the account service can build those links.

### Providers

`providers` sets which buttons appear, and in which order. Each entry is a provider id or `{ id, label }`.

```tsx
<Login
  apiUrl="http://localhost:8100/login"
  oauthApiUrl="http://localhost:8100"
  oauthReturnTo="https://app.example/oauth/callback"
  providers={['github', { id: 'apple', label: 'Sign in with Apple' }]}
/>
```

The boolean flags `enableApple`, `enableGoogle`, `enableFacebook`, `enableMicrosoft`, `enableGithub`, and `enableDiscord` still work when `providers` is omitted. `enableOAuth={false}` hides every provider button.

### Labels

Pass `labels` to replace any built-in string, including provider button text. Login and register success callbacks are typed separately: `AuthResponse` and `RegisterResponse`.

The card does not force a viewport height. Center it in the host layout. `className` and `style` apply to the card.

## Development

```bash
npm install
npm test
npm run build
```

GitHub Actions runs the same test and compile steps on pushes to `main` and `master`, and on pull requests.

The example app lives in `example/`.

## License

MIT
