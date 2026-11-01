import { useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { AccountClient, passkeysSupported, registerPasskey, type AccountPasskey } from '@posadskiy/account-client';
import { deletePasskey, listPasskeys } from '../account/api';
import { resolveLabels, type AuthLabels } from '../labels';

export function PasskeyManager({
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
  const [passkeys, setPasskeys] = useState<AccountPasskey[] | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supported = passkeysSupported();

  useEffect(() => {
    let active = true;
    listPasskeys(accountApiUrl, token)
      .then((next) => {
        if (active) setPasskeys(next);
      })
      .catch(() => {
        if (active) setError(labels.genericError);
      });
    return () => {
      active = false;
    };
  }, [accountApiUrl, token, labels.genericError]);

  const add = async () => {
    setPending(true);
    setError(null);
    try {
      const client = new AccountClient({ authUrl: accountApiUrl });
      client.session.adopt(token, null, null);
      await registerPasskey(client, label.trim() || undefined);
      setPasskeys(await listPasskeys(accountApiUrl, token));
      setLabel('');
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : labels.genericError);
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string) => {
    setPending(true);
    setError(null);
    try {
      await deletePasskey(accountApiUrl, token, id);
      setPasskeys((current) => current?.filter((passkey) => passkey.id !== id) ?? null);
    } catch {
      setError(labels.genericError);
    } finally {
      setPending(false);
    }
  };

  return (
    <Paper radius="md" p="xl" withBorder className={className} style={{ width: '100%', ...style }}>
      <Stack>
        <Title order={3}>{labels.passkeysTitle}</Title>
        {error && <Alert color="red">{error}</Alert>}
        {!supported && <Text>{labels.passkeysUnsupported}</Text>}
        {passkeys?.length === 0 && <Text>{labels.passkeysEmpty}</Text>}
        {passkeys?.map((passkey) => (
          <Stack key={passkey.id} gap="xs">
            <Text>{passkey.label || passkey.id}</Text>
            <Button variant="default" loading={pending} onClick={() => void remove(passkey.id)}>
              {labels.deletePasskey}
            </Button>
          </Stack>
        ))}
        {supported && (
          <>
            <TextInput label={labels.passkeyLabel} value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
            <Button loading={pending} onClick={() => void add()}>
              {labels.addPasskey}
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
}
