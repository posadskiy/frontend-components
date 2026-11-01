# User Component React

A React component for managing user information, built with Material-UI and TypeScript.

## Installation

```bash
npm install user-component-react
```

## Usage

```tsx
import { UserService } from 'user-component-react';

function App() {
  const handleError = (error: Error) => {
    // `error` is a sanitized Error. It does not include the bearer token or the raw response.
    console.error(error.message);
  };

  const handleSuccess = (message: string) => {
    console.log('Success:', message);
  };

  // Pass your JWT when the API requires authentication (optional; omit for unauthenticated requests)
  const bearerToken = 'your-jwt-token-here';

  return (
    <UserService
      apiUrl="https://your-api-url.com"
      userId="me"
      bearerToken={bearerToken}
      onError={handleError}
      onSuccess={handleSuccess}
    />
  );
}
```

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
| authApiUrl | string | No | Auth-service base URL for resending the confirmation email. A relative verification path is appended here. When omitted, `apiUrl` is used. |
| linkOrigin | string | No | Site origin written into the confirmation link, such as `https://grammarbar.com`. A path, query, or hash is dropped. Defaults to the current page origin. `http://localhost` and `http://127.0.0.1` are accepted with an optional port. |
| onError | (error: Error) => void | No | Sanitized error callback. The error has no request config or token. |
| onSuccess | (message: string) => void | No | Callback after a confirmation email is sent or the account is deleted. Deletion also replaces the card with the message. |
| allowDelete | boolean | No | Show account deletion. Defaults to `false`. The email prompt confirms the click; the API must authorize DELETE. |
| className | string | No | Class name for the root card |
| sx | SxProps | No | MUI `sx` prop for the root card (merged with defaults) |

## Features

- View the account email, display name, language, time zone, verification status, signup source, and sign-in methods
- Edit display name, language, and time zone from an explicit Edit action. Language and time zone are searchable lists, not free text
- JWT authentication support
- Responsive design
- Material-UI components
- TypeScript support
- Error handling with an in-card message and retry
- Success message after the confirmation email is sent and after account deletion
- Optional account deletion (`allowDelete`)
- Resend the confirmation email while `emailVerified` is false. After a successful send, the button waits 2 minutes. The account stays usable before the address is confirmed.

## API Endpoints

By default the component calls:

- GET `/v0/user/{userId}` - Fetch user information
- DELETE `/v0/user/{userId}` - Delete the user account
- POST `/account/verification-email` - Resend the confirmation email for the signed-in user. Body is `{ linkOrigin }`, where `linkOrigin` is the site origin only (`https://grammarbar.com`, or `http://localhost` with an optional port). The response is 204. This is shown only when the profile has `emailVerified: false`. Pass `authApiUrl` when auth-service is not `apiUrl`, for example `https://api.posadskiy.com/auth`.

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
