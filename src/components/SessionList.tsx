import { useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, Text, Title } from '@mantine/core';
import type { AccountSessionInfo } from '@posadskiy/account-client';
import { listSessions, revokeSession } from '../account/api';
import { resolveLabels, type AuthLabels } from '../labels';

export function SessionList({
  accountApiUrl,
  token,
  labels: labelOverrides,
  className,
  style,
}: {
  accountApiUrl: string;
  token: string;
  labels?: Partial<AuthLabels>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const labels = resolveLabels(labelOverrides);
  const [sessions, setSessions] = useState<AccountSessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listSessions(accountApiUrl, token)
      .then((next) => {
        if (active) setSessions(next);
      })
      .catch(() => {
        if (active) setError(labels.genericError);
      });
    return () => {
      active = false;
    };
  }, [accountApiUrl, token, labels.genericError]);

  const revoke = async (id: string) => {
    setPendingId(id);
    setError(null);
    try {
      await revokeSession(accountApiUrl, token, id);
      setSessions((current) => current?.filter((session) => session.id !== id) ?? null);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : labels.genericError);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
      <Stack>
        <Title order={3}>{labels.sessionsTitle}</Title>
        {error && <Alert color="red">{error}</Alert>}
        {sessions?.length === 0 && <Text>{labels.sessionsEmpty}</Text>}
        {sessions?.map((session) => (
          <Stack key={session.id} gap="xs">
            <Text>{session.userAgent || session.provider || session.id}</Text>
            <Button
              variant="default"
              loading={pendingId === session.id}
              onClick={() => void revoke(session.id)}
            >
              {labels.revokeSession}
            </Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
