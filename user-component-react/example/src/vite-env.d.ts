/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BEARER_TOKEN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_USER_ID?: string;
  readonly VITE_AUTH_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

