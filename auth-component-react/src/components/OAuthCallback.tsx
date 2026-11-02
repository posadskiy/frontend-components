import { useEffect, useRef, useState } from 'react';
import { Button, Container, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import axios from 'axios';
import { mapAuthError } from '../errors';
import { resolveLabels, type AuthLabels } from '../labels';
import { navigation, safeAppPath, stripOAuthQuery } from '../navigation';
import { subscribeFinalize } from '../oauth/finalize';
import type { OAuthTokenResponse } from '../types';
import type { AccountClient } from '@posadskiy/account-client';

export interface OAuthCallbackProps {
  oauthApiUrl: string;
  onSuccess: (data: OAuthTokenResponse) => void;
  onError: (error: Error) => void;
  onContinue?: () => void;
  returnPath?: string;
  /** When set, a successful callback stores the access token on this client. */
  accountClient?: AccountClient;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: React.CSSProperties;
}

export function OAuthCallback({
  oauthApiUrl,
  onSuccess,
  onError,
  onContinue,
  returnPath,
  accountClient,
  labels: labelOverrides,
  className,
  style,
}: OAuthCallbackProps) {
  const labels = resolveLabels(labelOverrides);
  const [status, setStatus] = useState<'pending' | 'error' | 'success'>('pending');
  const [message, setMessage] = useState(labels.callbackPendingMessage);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const labelsRef = useRef(labels);
  const returnPathRef = useRef(returnPath);
  const onContinueRef = useRef(onContinue);
  const accountRef = useRef(accountClient);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  labelsRef.current = labels;
  returnPathRef.current = returnPath;
  onContinueRef.current = onContinue;
  accountRef.current = accountClient;

  useEffect(() => {
    const currentLabels = labelsRef.current;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setStatus('error');
      setMessage(currentLabels.callbackMissingCode);
      navigation.replacePath(stripOAuthQuery(window.location.href));
      onErrorRef.current(new Error(currentLabels.callbackMissingCode));
      return;
    }

    let active = true;
    const { promise, unsubscribe } = subscribeFinalize(oauthApiUrl, code);

    promise.then(
      (data) => {
        if (!active) return;
        setStatus('success');
        setMessage(labelsRef.current.callbackSuccessMessage);
        accountRef.current?.session.adopt(
          data.access_token,
          typeof data.expires_in === 'number' ? data.expires_in : null,
          data.user_id,
        );
        onSuccessRef.current(data);
        navigation.replacePath(safeAppPath(returnPathRef.current) ?? stripOAuthQuery(window.location.href));
      },
      (caught: unknown) => {
        if (!active) return;
        if (axios.isCancel(caught) || (axios.isAxiosError(caught) && caught.code === 'ERR_CANCELED')) return;
        const mapped = mapAuthError(caught, 'oauth', labelsRef.current);
        setStatus('error');
        setMessage(mapped.message);
        navigation.replacePath(stripOAuthQuery(window.location.href));
        onErrorRef.current(mapped.error);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [oauthApiUrl]);

  const handleContinue = () => {
    if (onContinueRef.current) {
      onContinueRef.current();
      return;
    }
    const next = safeAppPath(returnPathRef.current);
    if (next) navigation.replacePath(next);
  };

  const showContinue = status === 'success' && (onContinue || returnPath);

  return (
    <Container size="xs" className={className} style={style}>
      <Paper radius="md" p="xl" withBorder style={{ width: '100%' }}>
        <Stack align="center" gap="md" role="status" aria-live="polite">
          <Title order={3}>
            {status === 'pending'
              ? labels.callbackPendingTitle
              : status === 'success'
                ? labels.callbackSuccessTitle
                : labels.callbackErrorTitle}
          </Title>
          {status === 'pending' ? (
            <>
              <Loader />
              <Text c="dimmed">{labels.callbackPendingMessage}</Text>
            </>
          ) : status === 'success' ? (
            <>
              <Text c="green" fw={500}>
                {message}
              </Text>
              {showContinue && (
                <Button onClick={handleContinue} fullWidth mt="md">
                  {labels.continue}
                </Button>
              )}
            </>
          ) : (
            <Text c="red">{message}</Text>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
