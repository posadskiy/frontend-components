import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Alert, Anchor, Paper, Stack, Text, TextInput, Title, Button } from '@mantine/core';
import axios from 'axios';
import { mapAuthError } from '../errors';
import { resolveLabels } from '../labels';
import { accountEndpoint, resolveAccountOrigin, resolveLinkOrigin } from '../linkOrigin';
import type { ForgotPasswordProps } from '../types';
import { useTurnstile } from '../captcha/useTurnstile';
import { isEmailAddress } from '../validate';

export function ForgotPassword({
  apiUrl,
  accountApiUrl,
  authApi,
  linkOrigin: linkOriginProp,
  onBack,
  onError,
  labels: labelOverrides,
  className,
  style,
  title,
  submitButtonText,
  getCaptchaToken,
  turnstileSiteKey,
  captcha,
}: ForgotPasswordProps) {
  const labels = resolveLabels(labelOverrides);
  const turnstile = useTurnstile(turnstileSiteKey, labels.completeCaptcha, labels.captchaLoadFailed);
  const resolveCaptchaToken = turnstile.getCaptchaToken ?? getCaptchaToken;
  const captchaField = turnstile.widget ?? captcha;
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    setEmailError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(labels.required);
      return;
    }
    if (!isEmailAddress(trimmed)) {
      setEmailError(labels.invalidEmail);
      return;
    }

    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const linkOrigin = resolveLinkOrigin(linkOriginProp);
      const captchaToken = resolveCaptchaToken ? await resolveCaptchaToken() : undefined;
      if (authApi?.forgotPassword) {
        await authApi.forgotPassword(trimmed, linkOrigin, captchaToken);
      } else {
        const origin = resolveAccountOrigin(accountApiUrl, apiUrl);
        await axios.post(
          accountEndpoint(origin, '/account/forgot-password'),
          { email: trimmed, linkOrigin, ...(captchaToken ? { captchaToken } : {}) },
          { signal: controller.signal },
        );
      }
      if (!mountedRef.current) return;
      setSent(true);
    } catch (caught) {
      if (!mountedRef.current) return;
      if (axios.isCancel(caught) || (axios.isAxiosError(caught) && caught.code === 'ERR_CANCELED')) return;
      const mapped = mapAuthError(caught, 'forgot', labels);
      setFormError(mapped.message);
      onError?.(mapped.error);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
      <Title ta="center" mb="md">
        {title ?? labels.forgotPasswordTitle}
      </Title>

      {onBack && (
        <Text ta="center" c="dimmed" mb="xl">
          <Anchor component="button" type="button" size="sm" onClick={onBack}>
            {labels.backToSignIn}
          </Anchor>
        </Text>
      )}

      {sent ? (
        <Text ta="center" role="status">
          {labels.forgotPasswordSent}
        </Text>
      ) : (
        <form noValidate onSubmit={handleSubmit} aria-describedby={formError ? errorId : undefined}>
          <Stack>
            {formError && (
              <Alert id={errorId} color="red" role="alert">
                {formError}
              </Alert>
            )}

            <TextInput
              required
              name="email"
              type="email"
              autoComplete="email"
              label={labels.email}
              placeholder={labels.emailPlaceholder}
              value={email}
              disabled={submitting}
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(null);
              }}
            />

            {captchaField}

            <Button type="submit" loading={submitting} fullWidth mt="xl">
              {submitButtonText ?? labels.forgotPasswordSubmit}
            </Button>
          </Stack>
        </form>
      )}
    </Paper>
  );
}
