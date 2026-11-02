import { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import { AccountClient, passkeysSupported, registerPasskey, type AccountPasskey } from '@posadskiy/account-client';
import { accountActionError, isCanceled } from '../api';
import type { PasskeysProps } from '../types';

const defaultCardSx = {
  maxWidth: 720,
  width: { xs: 'calc(100% - 32px)', sm: '100%' },
  mx: 'auto',
  mt: 4,
};

function clientFor(apiUrl: string, token: string | null | undefined): AccountClient {
  const client = new AccountClient({ authUrl: apiUrl });
  const accessToken = token?.trim();
  if (accessToken) client.session.adopt(accessToken, null, null);
  return client;
}

function loadError(error: unknown): Error {
  return accountActionError(error, 'Unable to load passkeys.', { 404: 'Passkeys are unavailable.' });
}

function actionError(error: unknown, fallback: string): Error {
  return accountActionError(error, fallback);
}

function pastLabel(prefix: string, value: string | null | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((now - then) / 86_400_000);
  if (days < 1) return `${prefix} today`;
  if (days === 1) return `${prefix} yesterday`;
  if (days < 30) return `${prefix} ${days} days ago`;
  return `${prefix} ${new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function passkeyTitle(passkey: AccountPasskey): string {
  const label = passkey.label?.trim();
  return label || 'Passkey';
}

function passkeyMeta(passkey: AccountPasskey): string | null {
  const parts = [pastLabel('Added', passkey.createdAt), pastLabel('Last used', passkey.lastUsedAt)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function Passkeys({ apiUrl, authApiUrl, bearerToken, onError, className, sx }: PasskeysProps) {
  const authUrl = (authApiUrl ?? apiUrl)?.trim() ?? '';
  const titleId = useId();
  const descriptionId = useId();
  const [passkeys, setPasskeys] = useState<AccountPasskey[] | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const cardSx = (sx ? [defaultCardSx, sx] : defaultCardSx) as SxProps<Theme>;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const supported = passkeysSupported();

  useEffect(() => {
    if (!authUrl) {
      setPasskeys([]);
      setError('Pass apiUrl or authApiUrl.');
      return;
    }
    const controller = new AbortController();
    let ignore = false;
    setError(null);
    setPasskeys(null);
    const load = async () => {
      try {
        const next = await clientFor(authUrl, bearerToken).listPasskeys(controller.signal);
        if (!ignore) setPasskeys(Array.isArray(next) ? next : []);
      } catch (caught) {
        if (ignore || isCanceled(caught)) return;
        const publicError = loadError(caught);
        onErrorRef.current?.(publicError);
        if (!ignore) {
          setPasskeys([]);
          setError(publicError.message);
        }
      }
    };
    void load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [authUrl, bearerToken, attempt]);

  const report = (caught: unknown, fallback: string) => {
    if (isCanceled(caught)) return;
    const publicError = actionError(caught, fallback);
    onErrorRef.current?.(publicError);
    setError(publicError.message);
  };

  const add = async () => {
    if (!authUrl || !supported) return;
    setPending(true);
    setError(null);
    try {
      const client = clientFor(authUrl, bearerToken);
      await registerPasskey(client, label.trim() || undefined);
      setPasskeys(await client.listPasskeys());
      setLabel('');
    } catch (caught) {
      report(caught, 'Unable to add a passkey.');
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string) => {
    if (!authUrl) return;
    setPending(true);
    setError(null);
    try {
      await clientFor(authUrl, bearerToken).deletePasskey(id);
      setPasskeys((current) => current?.filter((passkey) => passkey.id !== id) ?? null);
      setConfirmId(null);
    } catch (caught) {
      report(caught, 'Unable to remove that passkey.');
    } finally {
      setPending(false);
    }
  };

  const confirming = passkeys?.find((passkey) => passkey.id === confirmId) ?? null;

  return (
    <Card className={className} sx={cardSx}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          Passkeys
        </Typography>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button type="button" color="inherit" size="small" onClick={() => setAttempt((value) => value + 1)}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!supported && (
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            This browser cannot use passkeys.
          </Typography>
        )}
        {passkeys === null && (
          <Box role="status" aria-live="polite" aria-label="Loading passkeys">
            {[0, 1].map((row) => (
              <Box key={row} sx={{ py: 1.5 }}>
                <Skeleton width="36%" />
                <Skeleton width="52%" />
              </Box>
            ))}
          </Box>
        )}
        {passkeys?.length === 0 && !error && <Typography color="text.secondary">No passkeys yet.</Typography>}
        <Stack divider={<Divider flexItem />} spacing={0}>
          {passkeys?.map((passkey) => {
            const title = passkeyTitle(passkey);
            const meta = passkeyMeta(passkey);
            return (
              <Stack key={passkey.id} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.5 }}>
                <KeyIcon fontSize="small" color="action" aria-hidden />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
                  {meta && (
                    <Typography variant="body2" color="text.secondary">
                      {meta}
                    </Typography>
                  )}
                </Box>
                <Button
                  type="button"
                  color="error"
                  size="small"
                  disabled={pending}
                  aria-label={`Remove ${title}`}
                  onClick={() => setConfirmId(passkey.id)}
                  sx={{ flexShrink: 0 }}
                >
                  Remove
                </Button>
              </Stack>
            );
          })}
        </Stack>
        {supported && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, mt: 2 }}>
            <TextField
              label="Passkey name"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={pending}
              size="small"
              fullWidth
            />
            <Button type="button" variant="contained" disabled={pending} onClick={() => void add()} sx={{ flexShrink: 0 }}>
              {pending ? 'Working…' : 'Add a passkey'}
            </Button>
          </Stack>
        )}
      </CardContent>
      <Dialog
        open={Boolean(confirming)}
        onClose={() => {
          if (!pending) setConfirmId(null);
        }}
        maxWidth="sm"
        fullWidth
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {confirming && (
          <>
            <DialogTitle id={titleId}>Remove this passkey?</DialogTitle>
            <DialogContent>
              <DialogContentText id={descriptionId}>
                {passkeyTitle(confirming)} will no longer sign in on this account.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => setConfirmId(null)} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="button"
                color="error"
                variant="contained"
                disabled={pending}
                onClick={() => void remove(confirming.id)}
                startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {pending ? 'Removing…' : 'Remove passkey'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
}
