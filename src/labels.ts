import type { OAuthProvider } from './oauth/providerIds';

export interface AuthLabels {
  password: string;
  passwordPlaceholder: string;
  email: string;
  emailPlaceholder: string;
  noAccount: string;
  createAccount: string;
  haveAccount: string;
  signIn: string;
  orContinueWithEmail: string;
  confirmPassword: string;
  passwordTooShort: string;
  passwordMatchesIdentity: string;
  passwordMismatch: string;
  required: string;
  invalidEmail: string;
  forgotPassword: string;
  forgotPasswordTitle: string;
  forgotPasswordSubmit: string;
  forgotPasswordSent: string;
  backToSignIn: string;
  tooManyAttempts: string;
  invalidOrExpiredToken: string;
  resetPasswordTitle: string;
  resetPasswordSubmit: string;
  resetPasswordSuccess: string;
  invalidCredentials: string;
  confirmEmail: string;
  accountExists: string;
  genericError: string;
  completeCaptcha: string;
  captchaLoadFailed: string;
  oauthError: string;
  callbackPendingTitle: string;
  callbackPendingMessage: string;
  callbackSuccessTitle: string;
  callbackSuccessMessage: string;
  callbackErrorTitle: string;
  callbackMissingCode: string;
  continue: string;
  verifyEmailTitle: string;
  verifyEmailSuccess: string;
  confirmEmailChangeTitle: string;
  confirmEmailChangeSuccess: string;
  sessionsTitle: string;
  sessionsEmpty: string;
  revokeSession: string;
  passkeysTitle: string;
  passkeysEmpty: string;
  passkeysUnsupported: string;
  passkeyLabel: string;
  addPasskey: string;
  deletePasskey: string;
  provider: Record<OAuthProvider, string>;
  registerProvider: Record<OAuthProvider, string>;
}

const providerLabels: Record<OAuthProvider, string> = {
  apple: 'Sign in with Apple',
  google: 'Continue with Google',
  facebook: 'Continue with Facebook',
  microsoft: 'Continue with Microsoft',
  github: 'Continue with GitHub',
  discord: 'Continue with Discord',
};

export const defaultLabels: AuthLabels = {
  password: 'Password',
  passwordPlaceholder: 'Your password',
  email: 'Email',
  emailPlaceholder: 'your@email.com',
  noAccount: "Don't have an account yet?",
  createAccount: 'Create account',
  haveAccount: 'Already have an account?',
  signIn: 'Sign in',
  orContinueWithEmail: 'Or continue with email',
  confirmPassword: 'Confirm password',
  passwordTooShort: 'Password must be 10–72 characters.',
  passwordMatchesIdentity: 'Password must not match your email.',
  passwordMismatch: 'Passwords do not match.',
  required: 'This field is required.',
  invalidEmail: 'Enter a valid email address.',
  forgotPassword: 'Forgot password?',
  forgotPasswordTitle: 'Forgot password',
  forgotPasswordSubmit: 'Send reset link',
  forgotPasswordSent: 'If this account exists, we sent a link.',
  backToSignIn: 'Back to sign in',
  tooManyAttempts: 'Too many attempts. Please try again later.',
  invalidOrExpiredToken: 'Invalid or expired token',
  resetPasswordTitle: 'Choose a new password',
  resetPasswordSubmit: 'Update password',
  resetPasswordSuccess: 'Your password has been updated.',
  invalidCredentials: 'Invalid credentials',
  confirmEmail: 'Confirm your email before signing in.',
  accountExists: 'An account with these details already exists',
  genericError: 'Something went wrong. Please try again.',
  completeCaptcha: 'Complete the captcha',
  captchaLoadFailed: 'Captcha could not be loaded.',
  oauthError: 'OAuth authorization failed',
  callbackPendingTitle: 'Finishing up…',
  callbackPendingMessage: 'Completing sign-in with your provider',
  callbackSuccessTitle: 'Success!',
  callbackSuccessMessage: 'Sign-in successful!',
  callbackErrorTitle: 'Error',
  callbackMissingCode: 'Missing OAuth code in callback URL.',
  continue: 'Continue',
  verifyEmailTitle: 'Confirm your email',
  verifyEmailSuccess: 'Your email is confirmed. You can sign in.',
  confirmEmailChangeTitle: 'Confirm your new email',
  confirmEmailChangeSuccess: 'Your email address has been updated.',
  sessionsTitle: 'Sessions',
  sessionsEmpty: 'No other sessions.',
  revokeSession: 'Sign out this session',
  passkeysTitle: 'Passkeys',
  passkeysEmpty: 'No passkeys yet.',
  passkeysUnsupported: 'This browser cannot use passkeys.',
  passkeyLabel: 'Passkey name',
  addPasskey: 'Add a passkey',
  deletePasskey: 'Remove passkey',
  provider: providerLabels,
  registerProvider: {
    ...providerLabels,
    apple: 'Sign up with Apple',
  },
};

export function resolveLabels(overrides?: Partial<AuthLabels>): AuthLabels {
  if (!overrides) return defaultLabels;
  return {
    ...defaultLabels,
    ...overrides,
    provider: { ...defaultLabels.provider, ...overrides.provider },
    registerProvider: { ...defaultLabels.registerProvider, ...overrides.registerProvider },
  };
}
