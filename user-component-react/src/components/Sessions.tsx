import { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import ComputerIcon from '@mui/icons-material/Computer';
import DevicesIcon from '@mui/icons-material/Devices';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { AccountClient, type AccountSessionInfo } from '@posadskiy/account-client';
import { accountActionError, isCanceled } from '../api';
import { presentSessions, resolveCurrentSessionId, type SessionView } from '../sessionDisplay';
import type { SessionsProps } from '../types';

const defaultCardSx = {
  maxWidth: 720,
  width: { xs: 'calc(100% - 32px)', sm: '100%' },
  mx: 'auto',
  mt: 4,
};

type Confirm = { type: 'one'; id: string } | { type: 'others' } | { type: 'all' };

function clientFor(apiUrl: string, token: string | null | undefined): AccountClient {
  const client = new AccountClient({ authUrl: apiUrl });
  const accessToken = token?.trim();
  if (accessToken) client.session.adopt(accessToken, null, null);
  return client;
}

function loadError(error: unknown): Error {
  return accountActionError(error, 'Unable to load sessions.', { 404: 'Sessions are unavailable.' });
}

function revokeError(error: unknown): Error {
  return accountActionError(error, 'Unable to sign out that session.');
}

function rowLabel(view: SessionView): string {
  const title = view.title ?? 'Unknown device';
  return view.meta ? `${title}, ${view.meta}` : title;
}

export function Sessions({
  apiUrl,
  authApiUrl,
  bearerToken,
  currentSessionId,
  onError,
  onRevoked,
  className,
  sx,
}: SessionsProps) {
  const authUrl = (authApiUrl ?? apiUrl)?.trim() ?? '';
  const titleId = useId();
  const descriptionId = useId();
  const [sessions, setSessions] = useState<AccountSessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const cardSx = (sx ? [defaultCardSx, sx] : defaultCardSx) as SxProps<Theme>;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!authUrl) {
      setSessions([]);
      setError('Pass apiUrl or authApiUrl.');
      return;
    }
    const controller = new AbortController();
    let ignore = false;
    setError(null);
    setSessions(null);
    const load = async () => {
      try {
        const next = await clientFor(authUrl, bearerToken).listSessions(controller.signal);
        if (!ignore) setSessions(Array.isArray(next) ? next : []);
      } catch (caught) {
        if (ignore || isCanceled(caught)) return;
        const publicError = loadError(caught);
        onErrorRef.current?.(publicError);
        if (!ignore) {
          setSessions([]);
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

  const browserUa = typeof navigator === 'undefined' ? null : navigator.userAgent;
  const currentId = resolveCurrentSessionId(sessions ?? [], {
    explicitId: currentSessionId,
    accessToken: bearerToken,
    navigatorUserAgent: browserUa,
  });
  const views = presentSessions(sessions ?? [], currentId);
  const others = views.filter((view) => !view.current);

  const closeConfirm = () => {
    if (!pendingId) setConfirm(null);
  };

  const revokeIds = async (ids: string[]) => {
    if (!authUrl || ids.length === 0) return;
    setPendingId(ids.length === 1 ? ids[0] : '*');
    setError(null);
    const client = clientFor(authUrl, bearerToken);
    try {
      for (const id of ids) {
        await client.revokeSession(id);
        setSessions((current) => current?.filter((session) => session.id !== id) ?? null);
        onRevoked?.({ id, current: id === currentId });
      }
      setConfirm(null);
    } catch (caught) {
      if (!isCanceled(caught)) {
        const publicError = revokeError(caught);
        onErrorRef.current?.(publicError);
        setError(publicError.message);
      }
    } finally {
      setPendingId(null);
    }
  };

  const confirmCopy = (): { title: string; body: string; action: string; ids: string[] } | null => {
    if (!confirm) return null;
    if (confirm.type === 'one') {
      const view = views.find((item) => item.id === confirm.id);
      const name = view ? rowLabel(view) : 'This session';
      return {
        title: 'Sign out this session?',
        body: view?.current ? `You will be signed out on this device (${name}).` : `${name} will need to sign in again.`,
        action: view?.current ? 'Sign out this device' : 'Sign out',
        ids: [confirm.id],
      };
    }
    if (confirm.type === 'others') {
      const count = others.length;
      return {
        title: 'Sign out all other sessions?',
        body:
          count === 1
            ? '1 other session will need to sign in again. This device stays signed in.'
            : `${count} other sessions will need to sign in again. This device stays signed in.`,
        action: 'Sign out other sessions',
        ids: others.map((view) => view.id),
      };
    }
    return {
      title: 'Sign out all sessions?',
      body: 'Every device will need to sign in again.',
      action: 'Sign out all sessions',
      ids: views.map((view) => view.id),
    };
  };

  const pendingConfirm = confirmCopy();
  const showOthers = Boolean(currentId) && others.length > 0;
  const showAll = !currentId && views.length > 1;

  return (
    <Card className={className} sx={cardSx}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 1 }}
        >
          <Typography variant="h6" component="h2">
            Sessions
          </Typography>
          {showOthers && (
            <Button type="button" color="error" size="small" disabled={Boolean(pendingId)} onClick={() => setConfirm({ type: 'others' })}>
              Sign out all other sessions
            </Button>
          )}
          {showAll && (
            <Button type="button" color="error" size="small" disabled={Boolean(pendingId)} onClick={() => setConfirm({ type: 'all' })}>
              Sign out all sessions
            </Button>
          )}
        </Stack>
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
        {sessions === null && (
          <Box role="status" aria-live="polite" aria-label="Loading sessions">
            {[0, 1, 2].map((row) => (
              <Box key={row} sx={{ py: 1.5 }}>
                <Skeleton width="42%" />
                <Skeleton width="58%" />
              </Box>
            ))}
          </Box>
        )}
        {sessions?.length === 0 && !error && <Typography color="text.secondary">No sessions.</Typography>}
        <Stack divider={<Divider flexItem />} spacing={0}>
          {views.map((view) => {
            const title = view.title ?? 'Unknown device';
            const Icon = view.kind === 'phone' ? SmartphoneIcon : view.kind === 'computer' ? ComputerIcon : DevicesIcon;
            return (
              <Stack key={view.id} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.5 }}>
                <Icon fontSize="small" color="action" aria-hidden />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
                    {view.current && <Chip size="small" label="This device" color="primary" variant="outlined" />}
                    {view.provider && <Chip size="small" label={view.provider} variant="outlined" />}
                  </Stack>
                  {view.meta && (
                    <Typography variant="body2" color="text.secondary">
                      {view.meta}
                    </Typography>
                  )}
                </Box>
                <Button
                  type="button"
                  color="error"
                  size="small"
                  disabled={Boolean(pendingId)}
                  aria-label={view.current ? `Sign out this device, ${rowLabel(view)}` : `Sign out ${rowLabel(view)}`}
                  onClick={() => setConfirm({ type: 'one', id: view.id })}
                  sx={{ flexShrink: 0 }}
                >
                  Sign out
                </Button>
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
      <Dialog
        open={Boolean(pendingConfirm)}
        onClose={closeConfirm}
        maxWidth="sm"
        fullWidth
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {pendingConfirm && (
          <>
            <DialogTitle id={titleId}>{pendingConfirm.title}</DialogTitle>
            <DialogContent>
              <DialogContentText id={descriptionId}>{pendingConfirm.body}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={closeConfirm} disabled={Boolean(pendingId)}>
                Cancel
              </Button>
              <Button
                type="button"
                color="error"
                variant="contained"
                disabled={Boolean(pendingId)}
                onClick={() => void revokeIds(pendingConfirm.ids)}
                startIcon={pendingId ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {pendingId ? 'Signing out…' : pendingConfirm.action}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
}
