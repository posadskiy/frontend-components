import type { CSSProperties, ReactNode } from 'react';
import type { AuthLabels } from '../labels';
import type { OAuthProvider } from '../oauth/providerIds';

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  userId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  linkOrigin: string;
}

export interface RegisterResponse {
  emailVerified: boolean;
  id?: string;
  email?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  linkOrigin: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

export type { OAuthProvider } from '../oauth/providerIds';

export type OAuthProviderOption = OAuthProvider | { id: OAuthProvider; label?: string };

export interface AuthApi {
  /** Used when `apiUrl` is omitted. Password login posts through `apiUrl` when that is set. */
  login?: (email: string, password: string, linkOrigin: string, captchaToken?: string) => Promise<AuthResponse>;
  register?: (
    email: string,
    password: string,
    linkOrigin: string,
    region?: { locale?: string; timeZone?: string },
  ) => Promise<RegisterResponse>;
  forgotPassword?: (email: string, linkOrigin: string) => Promise<void>;
  resetPassword?: (token: string, password: string) => Promise<void>;
}

export interface AuthComponentProps {
  apiUrl?: string;
  authApi?: AuthApi;
  oauthApiUrl?: string;
  /** Absolute or site-relative URL auth-service should redirect back to with `?code=`. Cross-origin values are rejected unless their host is listed in `allowedReturnToHosts`. */
  oauthReturnTo?: string;
  /** Extra hosts allowed for `oauthReturnTo`. The current page origin is always allowed. */
  allowedReturnToHosts?: string[];
  onError?: (error: Error) => void;
  enableOAuth?: boolean;
  providers?: OAuthProviderOption[];
  enableGoogle?: boolean;
  enableFacebook?: boolean;
  enableApple?: boolean;
  enableMicrosoft?: boolean;
  enableGithub?: boolean;
  enableDiscord?: boolean;
  allowedOAuthHosts?: string[];
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: CSSProperties;
  /**
   * Site origin included as `linkOrigin`, such as `https://grammarbar.com`.
   * Defaults to `window.location.origin`. A path, query, hash, or non-HTTP(S) scheme is rejected.
   */
  linkOrigin?: string;
  /**
   * Origin that serves `/account/forgot-password` and `/account/reset-password`.
   * Defaults to the origin of `apiUrl`.
   */
  accountApiUrl?: string;
  /**
   * When set, signup and password reset include the returned token as `captchaToken`.
   * Login asks for it only after auth-service answers `Captcha is required`.
   */
  getCaptchaToken?: () => Promise<string | undefined>;
  /**
   * Cloudflare Turnstile site key. When set, the form renders the widget above the submit button
   * and sends its token. Signup and password reset always send it. Login sends it only after
   * auth-service answers `Captcha is required`.
   */
  turnstileSiteKey?: string;
  /** Rendered in the form, above the submit button. Ignored when `turnstileSiteKey` is set. */
  captcha?: ReactNode;
}

export interface LoginProps extends AuthComponentProps {
  onSuccess?: (response: AuthResponse) => void;
  showRegisterLink?: boolean;
  onSwitchToRegister?: () => void;
  showForgotPassword?: boolean;
  title?: string;
  submitButtonText?: string;
}

export interface ForgotPasswordProps {
  apiUrl?: string;
  accountApiUrl?: string;
  authApi?: AuthApi;
  linkOrigin?: string;
  onBack?: () => void;
  onError?: (error: Error) => void;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: CSSProperties;
  title?: string;
  submitButtonText?: string;
  getCaptchaToken?: () => Promise<string | undefined>;
  /** Cloudflare Turnstile site key. Renders the widget and sends its token with the reset request. */
  turnstileSiteKey?: string;
  /** Rendered above the submit button. Ignored when `turnstileSiteKey` is set. */
  captcha?: ReactNode;
}

export interface ResetPasswordProps {
  apiUrl?: string;
  accountApiUrl?: string;
  authApi?: AuthApi;
  /** Reset token. Defaults to the `token` query parameter. */
  token?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: CSSProperties;
  title?: string;
  submitButtonText?: string;
}

export interface RegisterProps extends AuthComponentProps {
  onSuccess?: (response: RegisterResponse) => void;
  showLoginLink?: boolean;
  onSwitchToLogin?: () => void;
  title?: string;
  submitButtonText?: string;
}
