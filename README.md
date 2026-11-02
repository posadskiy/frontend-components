# Frontend components

Monorepo of browser packages for authentication, account sessions, and user profile UI.

| Package | Description |
| --- | --- |
| [`auth-component-react`](./auth-component-react/) | Login, registration, OAuth, and password flows (Mantine) |
| [`user-component-react`](./user-component-react/) | Sessions, passkeys, and user account UI |
| [`@posadskiy/account-client`](./account-client/) | In-memory access token and cookie-backed refresh client |

Each package is published independently. See the README in each directory for install and usage.

## Development

From a package directory:

```bash
cd auth-component-react   # or user-component-react, account-client
npm ci
npm test
npm run build
```

CI runs the same checks for all three packages (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).
