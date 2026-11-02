# User Component React

A React component for managing user information, built with Material-UI and TypeScript.

## Installation

```bash
npm install user-component-react
```

## Usage

```tsx
import { Passkeys, Sessions, UserService } from 'user-component-react';

function App() {
  const handleError = (error: Error) => {
    // `error` is a sanitized Error. It does not include the bearer token or the raw response.
    console.error(error.message);
  };

  const handleSuccess = (message: string) => {
    console.log('Success:', message);
  };

  // Pass your access token when the API requires authentication. Password, email, verification, and erasure
  // go to auth-service through @posadskiy/account-client and include the browser session cookie.
  const bearerToken = 'your-jwt-token-here';

  return (
    <>
      <UserService
        apiUrl="https://your-api-url.com"
        userId="me"
        bearerToken={bearerToken}
        onError={handleError}
        onSuccess={handleSuccess}
      />
      <Sessions
        apiUrl="https://your-api-url.com"
        authApiUrl="https://your-auth-url.com"
        bearerToken={bearerToken}
        onError={handleError}
      />
      <Passkeys
        apiUrl="https://your-api-url.com"
        authApiUrl="https://your-auth-url.com"
        bearerToken={bearerToken}
        onError={handleError}
      />
    </>
  );
}
```

`Sessions` and `Passkeys` are the signed-in account cards. Pass the same `bearerToken` you pass to `UserService`, and set `authApiUrl` to auth-service when that host is not `apiUrl`. A session row shows the browser and device, when it signed in, the client IP, and how the account signed in. This browser is labeled **This device** when the access token carries a session id or the user agent matches one session. **Sign out** asks first. **Sign out all other sessions** leaves this device signed in. Passkeys lists each key, asks before removing one, and can register a new key in this browser.

## Styles

**Styles are included.** The component uses Material-UI (CSS-in-JS); wrap your app in MUI's `ThemeProvider` (and optionally `CssBaseline`) so the component is styled by default.

To override the default card layout, pass **`className`** or **`sx`** (MUI's style prop):

```tsx
<UserService
  apiUrl="..."
  userId="user123"
  className="my-profile-card"
  sx={{ maxWidth: 500, mt: 2 }}
  onError={handleError}
  onSuccess={handleSuccess}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| apiUrl | string | Yes | The base URL of your user service API |
| userId | string | Yes | The ID of the user to display (use `"me"` for the current user). Inserted wherever a URL contains `{userId}`. |
| urls | UserUrls | No | Paths or absolute URLs for get, delete, and the confirmation-email resend. `{userId}` is URL-encoded. Profile methods default to `/v0/user/{userId}`. Resend defaults to `POST /account/verification-email`. |
| bearerToken | string \| null | No | JWT for API authentication; when omitted, requests are sent without Authorization (may get 401) |
| authApiUrl | string | No | Auth-service base URL for the confirmation email, password, email change, and account erasure. A relative path is appended here. When omitted, `apiUrl` is used. |
| linkOrigin | string | No | Site origin written into the confirmation link, such as `https://grammarbar.com`. A path, query, or hash is dropped. Defaults to the current page origin. `http://localhost` and `http://127.0.0.1` are accepted with an optional port. |
| onError | (error: Error) => void | No | Sanitized error callback. The error has no request config or token. |
| onSuccess | (message: string) => void | No | Callback after a confirmation email is sent, a password is saved, an email-change link is sent, or the account is deleted. Deletion also replaces the card with the message. |
| allowDelete | boolean | No | Show account deletion inside the expanded details. Defaults to `false`. The email prompt confirms the click; the request is auth-service `POST /account/erase`. |
| className | string | No | Class name for the root card |
| sx | SxProps | No | MUI `sx` prop for the root card (merged with defaults) |

### Sessions

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| apiUrl | string | No | Used as the auth-service base URL when `authApiUrl` is omitted |
| authApiUrl | string | No | Auth-service base URL. Sessions load from `GET /account/sessions` |
| bearerToken | string \| null | No | Access token. The browser session cookie is still sent |
| currentSessionId | string \| null | No | Session id for this browser. Overrides token and user-agent detection |
| onError | (error: Error) => void | No | Sanitized error callback |
| onRevoked | (session: { id: string; current: boolean }) => void | No | Fired after each session is signed out. `current` is true for this browser |
| className | string | No | Class name for the root card |
| sx | SxProps | No | MUI `sx` prop for the root card |

### Passkeys

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| apiUrl | string | No | Used as the auth-service base URL when `authApiUrl` is omitted |
| authApiUrl | string | No | Auth-service base URL. Passkeys load from `GET /account/passkeys` |
| bearerToken | string \| null | No | Access token. The browser session cookie is still sent |
| onError | (error: Error) => void | No | Sanitized error callback |
| className | string | No | Class name for the root card |
| sx | SxProps | No | MUI `sx` prop for the root card |

One of `apiUrl` or `authApiUrl` is required for `Sessions` and for `Passkeys`.

## Features

- Compact identity card: avatar, display name, email, and verification status. Language, time zone, signup source, and sign-in methods stay hidden until **Show account details**
- Edit display name, language, and time zone from the expanded profile. Language and time zone are searchable lists, not free text
- Change or set the password, and request an email change, through auth-service. The address on the card changes only after the new address is confirmed
- JWT authentication support
- Responsive design
- Material-UI components
- TypeScript support
- Error handling with an in-card message and retry
- Success message after the confirmation email is sent and after account deletion
- Optional account deletion (`allowDelete`)
- **Verify email** while `emailVerified` is false, on the compact card. After a successful send, the button waits 2 minutes. The account stays usable before the address is confirmed.

## API Endpoints

By default the component calls:

- GET `/v0/user/{userId}` - Fetch user information
- DELETE `/v0/user/{userId}` - Delete the user account
- POST `/account/verification-email` - Send the confirmation email for the signed-in user. Body is `{ linkOrigin }`, where `linkOrigin` is the site origin only (`https://grammarbar.com`, or `http://localhost` with an optional port). The response is 204. The button is **Verify email**, shown only when the profile has `emailVerified: false`. Pass `authApiUrl` when auth-service is not `apiUrl`, for example `https://api.posadskiy.com/auth`.
- POST `/account/password` - Change the password. Body is `{ currentPassword, password }`. The new password is 10–72 characters and must not match the email. Other sessions are signed out.
- POST `/account/password/set` - Set a password when the account does not have one (a Google-only signup, for example). Body is `{ password }`.
- POST `/account/email` - Request an email change. Body is `{ email, linkOrigin, password? }`. `password` is sent when the account has one. The current email stays until the link sent to the new address is opened.

Pass `urls` to point those calls at another service. A relative path is appended to `apiUrl`. An absolute `http` or `https` URL is used as given. `{userId}` is replaced with the encoded id.

```tsx
<UserService
  apiUrl="https://api.example.com"
  userId="42"
  urls={{
    user: '/api/accounts/{userId}',
    delete: '/api/accounts/{userId}/close',
  }}
/>
```

`user` applies to every method that does not set its own `get` or `delete` URL.

When `bearerToken` is provided, all requests include the Bearer token in the `Authorization` header. Profile images are rendered only when `pictureUrl` is an `https` URL.

## Development

```bash
npm install
npm test
npm run build
```

GitHub Actions runs the same test and compile steps on pushes to `main` and `master`, and on pull requests.

## Local testing

```bash
cd example
npm install
npm run dev
```

The example opens at http://localhost:3000. Set `VITE_API_URL`, `VITE_USER_ID`, and `VITE_BEARER_TOKEN` in `example/.env` when the user service is not on `http://localhost:8095`. Set `VITE_AUTH_API_URL` when auth-service is separate, for example `http://localhost:8100`. Wrap the example in MUI's `ThemeProvider`, which `example/src/index.tsx` already does.

## License

MIT 
