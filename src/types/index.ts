import type { SxProps, Theme } from '@mui/material';

export interface User {
  id: number | string;
  email: string;
  emailVerified: boolean;
  pictureUrl?: string;
  createdVia: string;
  authProviders: string[];
  displayName?: string | null;
  locale?: string | null;
  timeZone?: string | null;
  avatarUrl?: string | null;
}

export interface UserUrls {
  /**
   * Path or absolute URL used for GET when a method does not set its own.
   * `{userId}` is replaced with the encoded id. Default: `/v0/user/{userId}`.
   * An absolute `http` or `https` URL is called as-is. Any other value is appended to `apiUrl`.
   */
  user?: string;
  /** GET path or absolute URL. Falls back to `user`. */
  get?: string;
  /** Kept so existing hosts still type-check. Erasure is `POST /account/erase` on auth-service. */
  delete?: string;
  /**
   * POST path or absolute URL for resending the confirmation email.
   * `{userId}` is URL-encoded when present. Default: `/account/verification-email`.
   * The body is `{ linkOrigin }` and the response is 204.
   */
  verificationEmail?: string;
}

export interface UserServiceProps {
  apiUrl: string;
  userId: string;
  /**
   * Resource URLs. Omit this to load the profile from `GET /v0/user/{userId}`.
   */
  urls?: UserUrls;
  /** Bearer token for authenticated requests to /v0/user/me and related endpoints. When omitted, requests are sent without Authorization (may get 401). */
  bearerToken?: string | null;
  /**
   * Auth-service base URL for confirmation email, password, email change, and account erasure.
   * A relative path is appended here. When omitted, `apiUrl` is used.
   */
  authApiUrl?: string;
  /**
   * Site origin written into the confirmation link, such as `https://grammarbar.com`.
   * A path, query, or hash is dropped. Defaults to the current page origin.
   */
  linkOrigin?: string;
  onError?: (error: Error) => void;
  /** Confirmation email, password, email-change link, and account deletion. */
  onSuccess?: (message: string) => void;
  /**
   * Show account deletion inside the expanded details. Defaults to false.
   * The email prompt confirms the click. The request goes to auth-service `POST /account/erase`
   * (`authApiUrl`, or `apiUrl` when that is omitted). A password is sent when the field is filled.
   */
  allowDelete?: boolean;
  /** Product whose marketing preference is shown. `grammarbar`, `costy`, or `repeaty`. */
  product?: 'grammarbar' | 'costy' | 'repeaty';
  /** Optional class name for the root card. */
  className?: string;
  /** Optional MUI `sx` prop for the root card. Merged with the default layout. */
  sx?: SxProps<Theme>;
} 