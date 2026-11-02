/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOGIN_API_URL?: string;
  readonly VITE_REGISTER_API_URL?: string;
  readonly VITE_OAUTH_API_URL?: string;
  readonly VITE_ACCOUNT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
