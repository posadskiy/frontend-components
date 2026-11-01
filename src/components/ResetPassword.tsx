import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Alert, Paper, PasswordInput, Stack, Text, Title, Button } from '@mantine/core';
import axios from 'axios';
import { mapAuthError } from '../errors';
import { resolveLabels } from '../labels';
import { accountEndpoint, resolveAccountOrigin } from '../linkOrigin';
import { navigation, stripResetToken } from '../navigation';
import type { ResetPasswordProps } from '../types';
import { passwordIssue } from '../validate';

function readToken(explicit: string | undefined): string {
  if (explicit !== undefined) return explicit.trim();
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
}

export function ResetPassword({
  apiUrl,
  accountApiUrl,
  authApi,
  token: tokenProp,
  onSuccess,
  onError,
  labels: labelOverrides,
  className,
  style,
  title,
  submitButtonText,
}: ResetPasswordProps) {
  const labels = resolveLabels(labelOverrides);
  const errorId = useId();
  const [token] = useState(() => readToken(tokenProp));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!token) onErrorRef.current?.(new Error(labels.invalidOrExpiredToken));
  }, [token, labels.invalidOrExpiredToken]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !token) return;

    setFormError(null);
    setPasswordError(null);
    setConfirmError(null);

    if (!password) {
      setPasswordError(labels.required);
      return;
    }
    if (passwordIssue(password, []) === 'length') {
      setPasswordError(labels.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError(labels.passwordMismatch);
      return;
    }

    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (authApi?.resetPassword) {
        await authApi.resetPassword(token, password);
      } else {
        const origin = resolveAccountOrigin(accountApiUrl, apiUrl);
        await axios.post(
          accountEndpoint(origin, '/account/reset-password'),
          { token, password },
          { signal: controller.signal, withCredentials: true },
        );
      }
      if (!mountedRef.current) return;
      navigation.replacePath(stripResetToken(window.location.href));
      setSucceeded(true);
      onSuccessRef.current?.();
    } catch (caught) {
      if (!mountedRef.current) return;
      if (axios.isCancel(caught) || (axios.isAxiosError(caught) && caught.code === 'ERR_CANCELED')) return;
      const mapped = mapAuthError(caught, 'reset', labels);
      setFormError(mapped.message);
      onErrorRef.current?.(mapped.error);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
      <Title ta="center" mb="md">
        {title ?? labels.resetPasswordTitle}
      </Title>

      {succeeded ? (
        <Text ta="center" role="status">
          {labels.resetPasswordSuccess}
        </Text>
      ) : !token ? (
        <Alert color="red" role="alert">
          {labels.invalidOrExpiredToken}
        </Alert>
      ) : (
        <form noValidate onSubmit={handleSubmit} aria-describedby={formError ? errorId : undefined}>
          <Stack>
            {formError && (
              <Alert id={errorId} color="red" role="alert">
                {formError}
              </Alert>
            )}

            <PasswordInput
              required
              name="password"
              autoComplete="new-password"
              label={labels.password}
              placeholder={labels.passwordPlaceholder}
              value={password}
              disabled={submitting}
              error={passwordError}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
            />

            <PasswordInput
              required
              name="confirmPassword"
              autoComplete="new-password"
              label={labels.confirmPassword}
              placeholder={labels.passwordPlaceholder}
              value={confirmPassword}
              disabled={submitting}
              error={confirmError}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setConfirmError(null);
              }}
            />

            <Button type="submit" loading={submitting} fullWidth mt="xl">
              {submitButtonText ?? labels.resetPasswordSubmit}
            </Button>
          </Stack>
        </form>
      )}
    </Paper>
  );
}
