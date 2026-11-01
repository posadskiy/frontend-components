import { useState, type FormEvent } from 'react';
import { Alert, Button, Paper, Stack, Title } from '@mantine/core';
import { AccountClient, AccountHttpError } from '@posadskiy/account-client';
import { resolveLabels } from '../labels';
import type { AuthLabels } from '../labels';

function readToken(explicit: string | undefined): string {
  if (explicit !== undefined) return explicit.trim();
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
}

function TokenLink({
  accountApiUrl,
  token: tokenProp,
  title,
  success,
  action,
  labels: labelOverrides,
  className,
  style,
}: {
  accountApiUrl: string;
  token?: string;
  title: string;
  success: string;
  action: (client: AccountClient, token: string) => Promise<void>;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const labels = resolveLabels(labelOverrides);
  const [token] = useState(() => readToken(tokenProp));
  const [error, setError] = useState<string | null>(token ? null : labels.invalidOrExpiredToken);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = new AccountClient({ authUrl: accountApiUrl });
      await action(client, token);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof AccountHttpError && caught.status === 400 ? labels.invalidOrExpiredToken : labels.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
      <Title ta="center" mb="md">
        {title}
      </Title>
      {done ? (
        <Alert color="green">{success}</Alert>
      ) : (
        <form onSubmit={submit}>
          <Stack>
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={submitting} disabled={!token}>
              {labels.continue}
            </Button>
          </Stack>
        </form>
      )}
    </Paper>
  );
}

export function VerifyEmail(props: {
  accountApiUrl: string;
  token?: string;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const labels = resolveLabels(props.labels);
  return (
    <TokenLink
      {...props}
      title={labels.verifyEmailTitle}
      success={labels.verifyEmailSuccess}
      action={(client, token) => client.verifyEmail(token)}
    />
  );
}

export function ConfirmEmailChange(props: {
  accountApiUrl: string;
  token?: string;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const labels = resolveLabels(props.labels);
  return (
    <TokenLink
      {...props}
      title={labels.confirmEmailChangeTitle}
      success={labels.confirmEmailChangeSuccess}
      action={(client, token) => client.confirmEmailChange(token)}
    />
  );
}
