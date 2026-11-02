import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Alert, Anchor, Divider, Paper, PasswordInput, Stack, Text, TextInput, Title, Button } from '@mantine/core';
import axios from 'axios';
import { captchaIsRequired, mapAuthError } from '../errors';
import { resolveLabels } from '../labels';
import { accountEndpoint, resolveAccountOrigin, resolveLinkOrigin } from '../linkOrigin';
import { browserRegion } from '../region';
import { resolveProviders } from '../oauth/resolveProviders';
import type { AuthResponse, LoginProps, RegisterProps, RegisterResponse } from '../types';
import { isAuthResponse, isEmailAddress, isRegisterResponse, passwordIssue, withoutRefreshToken } from '../validate';
import { useTurnstile } from '../captcha/useTurnstile';
import { OAuthButtons } from './OAuthButtons';
import { useOAuthAction } from './useOAuthAction';

type CredentialsFormProps =
  | (LoginProps & { mode: 'login'; onForgotPassword?: () => void })
  | (RegisterProps & { mode: 'register' });

type PendingVerification = { email: string; response: RegisterResponse };

export function CredentialsForm(props: CredentialsFormProps) {
  const account = props.mode === 'login' ? props.accountClient : undefined;
  const {
    mode,
    apiUrl,
    accountApiUrl,
    authApi,
    oauthApiUrl,
    oauthReturnTo,
    allowedReturnToHosts,
    onError,
    enableOAuth,
    providers: providerOptions,
    enableGoogle,
    enableFacebook,
    enableApple,
    enableMicrosoft,
    enableGithub,
    enableDiscord,
    allowedOAuthHosts,
    labels: labelOverrides,
    className,
    style,
    title,
    submitButtonText,
    linkOrigin: linkOriginProp,
    getCaptchaToken,
    turnstileSiteKey,
    captcha,
  } = props;

  const labels = resolveLabels(labelOverrides);
  const turnstile = useTurnstile(turnstileSiteKey, labels.completeCaptcha, labels.captchaLoadFailed);
  const resolveCaptchaToken = turnstile.getCaptchaToken ?? getCaptchaToken;
  const captchaField = turnstile.widget ?? captcha;
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingVerify, setPendingVerify] = useState<PendingVerification | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const providers = resolveProviders(
    {
      enableOAuth,
      providers: providerOptions,
      enableGoogle,
      enableFacebook,
      enableApple,
      enableMicrosoft,
      enableGithub,
      enableDiscord,
    },
    mode,
    labels,
  );

  const oauth = useOAuthAction({
    oauthApiUrl,
    oauthReturnTo,
    allowedOAuthHosts,
    allowedReturnToHosts,
    onError,
    disabled: submitting,
    labels,
  });

  const busy = submitting || oauth.activeProvider !== null;
  const switchToRegister = mode === 'login' ? props.onSwitchToRegister : undefined;
  const switchToLogin = mode === 'register' ? props.onSwitchToLogin : undefined;
  const showRegisterLink = mode === 'login' ? props.showRegisterLink !== false : false;
  const showLoginLink = mode === 'register' ? props.showLoginLink !== false : false;
  const onForgotPassword = props.mode === 'login' ? props.onForgotPassword : undefined;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setFormError(null);
    setPasswordError(null);
    setConfirmError(null);
    setEmailError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError(labels.required);
      return;
    }
    if (!isEmailAddress(trimmedEmail)) {
      setEmailError(labels.invalidEmail);
      return;
    }
    if (!password) {
      setPasswordError(labels.required);
      return;
    }
    if (props.mode === 'register') {
      const issue = passwordIssue(password, [trimmedEmail]);
      if (issue === 'length') {
        setPasswordError(labels.passwordTooShort);
        return;
      }
      if (issue === 'identity') {
        setPasswordError(labels.passwordMatchesIdentity);
        return;
      }
      if (password !== confirmPassword) {
        setConfirmError(labels.passwordMismatch);
        return;
      }
    }

    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (props.mode === 'login') {
        if (!authApi?.login && !apiUrl) {
          throw new Error('Either apiUrl or authApi.login must be provided');
        }
        const linkOrigin = resolveLinkOrigin(linkOriginProp);
        const login = async (captchaToken?: string) => {
          const payload = { email: trimmedEmail, password, linkOrigin, ...(captchaToken ? { captchaToken } : {}) };
          return authApi?.login
            ? authApi.login(payload.email, payload.password, payload.linkOrigin, captchaToken)
            : (
                await axios.post<AuthResponse>(apiUrl as string, payload, {
                  signal: controller.signal,
                  withCredentials: true,
                })
              ).data;
        };
        let response: AuthResponse;
        try {
          response = await login();
        } catch (error) {
          if (!resolveCaptchaToken || !captchaIsRequired(error)) throw error;
          const captchaToken = await resolveCaptchaToken();
          if (!captchaToken) throw error;
          response = await login(captchaToken);
        }
        if (!mountedRef.current) return;
        if (!isAuthResponse(response)) throw new Error(labels.genericError);
        const session = withoutRefreshToken(response);
        const record = response as AuthResponse & { user_id?: string };
        account?.session.adopt(
          session.access_token,
          session.expires_in,
          record.user_id ?? session.userId ?? null,
        );
        props.onSuccess?.(session);
      } else {
        if (!authApi?.register && !apiUrl) {
          throw new Error('Either apiUrl or authApi.register must be provided');
        }
        const linkOrigin = resolveLinkOrigin(linkOriginProp);
        const captchaToken = resolveCaptchaToken ? await resolveCaptchaToken() : undefined;
        const region = browserRegion();
        const payload = {
          email: trimmedEmail,
          password,
          linkOrigin,
          ...region,
          ...(captchaToken ? { captchaToken } : {}),
        };
        const response = authApi?.register
          ? await authApi.register(payload.email, payload.password, payload.linkOrigin, region)
          : (
              await axios.post<RegisterResponse>(apiUrl as string, payload, {
                signal: controller.signal,
                withCredentials: true,
              })
            ).data;
        if (!mountedRef.current) return;
        if (!isRegisterResponse(response)) throw new Error(labels.genericError);
        if (!response.emailVerified) {
          setPendingVerify({ email: trimmedEmail, response });
          setResendStatus(null);
          return;
        }
        props.onSuccess?.(response);
      }
    } catch (caught) {
      if (!mountedRef.current) return;
      if (axios.isCancel(caught) || (axios.isAxiosError(caught) && caught.code === 'ERR_CANCELED')) return;
      const mapped = mapAuthError(caught, mode, labels);
      if (mapped.field === 'email') setEmailError(mapped.message);
      else setFormError(mapped.message);
      onError?.(mapped.error);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };


  const leaveVerifyPending = () => {
    const pending = pendingVerify;
    if (!pending || props.mode !== 'register') return;
    setPendingVerify(null);
    props.onSuccess?.(pending.response);
    props.onSwitchToLogin?.();
  };

  const resendVerification = async () => {
    if (!pendingVerify || resendPending) return;
    setResendPending(true);
    setFormError(null);
    setResendStatus(null);
    try {
      const linkOrigin = resolveLinkOrigin(linkOriginProp);
      const captchaToken = resolveCaptchaToken ? await resolveCaptchaToken() : undefined;
      if (authApi?.resendVerificationEmail) {
        await authApi.resendVerificationEmail(pendingVerify.email, linkOrigin, captchaToken);
      } else {
        const origin = resolveAccountOrigin(accountApiUrl, apiUrl);
        await axios.post(
          accountEndpoint(origin, '/account/verification-email'),
          { email: pendingVerify.email, linkOrigin, ...(captchaToken ? { captchaToken } : {}) },
          { withCredentials: true },
        );
      }
      if (!mountedRef.current) return;
      setResendStatus(labels.checkEmailResent);
    } catch (caught) {
      if (!mountedRef.current) return;
      const mapped = mapAuthError(caught, 'forgot', labels);
      setFormError(mapped.message);
      onError?.(mapped.error);
    } finally {
      if (mountedRef.current) setResendPending(false);
    }
  };

  if (pendingVerify) {
    return (
      <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
        <Title order={2} mb="sm">
          {labels.checkEmailTitle}
        </Title>
        <Text c="dimmed" mb="xl">
          {labels.checkEmailBody.replace('{email}', pendingVerify.email)}
        </Text>
        <Stack>
          {formError && (
            <Alert color="red" role="alert">
              {formError}
            </Alert>
          )}
          {resendStatus && (
            <Alert color="green" role="status">
              {resendStatus}
            </Alert>
          )}
          {captchaField}
          <Button type="button" loading={resendPending} fullWidth onClick={() => void resendVerification()}>
            {labels.checkEmailResend}
          </Button>
          <Button type="button" variant="subtle" fullWidth disabled={resendPending} onClick={leaveVerifyPending}>
            {labels.backToSignIn}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
      <Title ta="center" mb="md">
        {title ?? (mode === 'login' ? 'Welcome back!' : 'Create an account')}
      </Title>

      {showRegisterLink && switchToRegister && (
        <Text ta="center" c="dimmed" mb="xl">
          {labels.noAccount}{' '}
          <Anchor component="button" type="button" size="sm" onClick={switchToRegister}>
            {labels.createAccount}
          </Anchor>
        </Text>
      )}

      {showLoginLink && switchToLogin && (
        <Text ta="center" c="dimmed" mb="xl">
          {labels.haveAccount}{' '}
          <Anchor component="button" type="button" size="sm" onClick={switchToLogin}>
            {labels.signIn}
          </Anchor>
        </Text>
      )}

      <OAuthButtons
        providers={providers}
        activeProvider={oauth.activeProvider}
        disabled={submitting}
        error={oauth.error}
        onSelect={oauth.start}
      />

      {providers.length > 0 && (
        <Divider
          label={labels.orContinueWithEmail}
          labelPosition="center"
          my="xl"
        />
      )}

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
            disabled={busy}
            error={emailError}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(null);
            }}
          />

          <PasswordInput
            required
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            label={labels.password}
            placeholder={labels.passwordPlaceholder}
            value={password}
            disabled={busy}
            error={passwordError}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
            }}
          />

          {mode === 'register' && (
            <PasswordInput
              required
              name="confirmPassword"
              autoComplete="new-password"
              label={labels.confirmPassword}
              placeholder={labels.passwordPlaceholder}
              value={confirmPassword}
              disabled={busy}
              error={confirmError}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setConfirmError(null);
              }}
            />
          )}

          {mode === 'login' && onForgotPassword && (
            <Text ta="right">
              <Anchor component="button" type="button" size="sm" disabled={busy} onClick={onForgotPassword}>
                {labels.forgotPassword}
              </Anchor>
            </Text>
          )}

          {captchaField}

          <Button type="submit" loading={submitting} disabled={oauth.activeProvider !== null} fullWidth mt="xl">
            {submitButtonText ?? (mode === 'login' ? 'Sign in' : 'Register')}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
