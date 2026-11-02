import axios from 'axios';
import type { AuthLabels } from './labels';

export interface MappedAuthError {
  message: string;
  field?: 'email';
  error: Error;
}

export function readServerMessage(data: unknown): string | undefined {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  for (const key of ['message', 'error_description', 'detail', 'error']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** Login returns 400 "Captcha is required" after repeated wrong passwords on one account. */
export function captchaIsRequired(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return false;
  return readServerMessage(error.response.data) === 'Captcha is required';
}

export function mapAuthError(
  error: unknown,
  mode: 'login' | 'register' | 'oauth' | 'forgot' | 'reset',
  labels: AuthLabels,
): MappedAuthError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const serverMessage = readServerMessage(error.response?.data);

    if (status === 429) {
      return { message: labels.tooManyAttempts, error: new Error(labels.tooManyAttempts) };
    }

    if (mode === 'login' && status === 401) {
      return { message: labels.invalidCredentials, field: 'email', error: new Error(labels.invalidCredentials) };
    }

    if (mode === 'login' && status === 403) {
      return { message: labels.confirmEmail, error: new Error(labels.confirmEmail) };
    }

    if (mode === 'register' && status === 409) {
      return { message: labels.accountExists, error: new Error(labels.accountExists) };
    }

    if (status && status >= 500) {
      return { message: labels.genericError, error: new Error(labels.genericError) };
    }

    if (!error.response) {
      return { message: labels.genericError, error: new Error(labels.genericError) };
    }

    const message =
      serverMessage ||
      (mode === 'reset' && status === 400
        ? labels.invalidOrExpiredToken
        : mode === 'oauth'
          ? labels.oauthError
          : labels.genericError);
    return { message, error: new Error(message) };
  }

  if (error instanceof Error && error.message) {
    return { message: error.message, error };
  }

  const fallback = mode === 'oauth' ? labels.oauthError : labels.genericError;
  return { message: fallback, error: new Error(fallback) };
}
