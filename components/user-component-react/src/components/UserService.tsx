import { useActionState, useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
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
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockResetIcon from '@mui/icons-material/LockReset';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import {
  accountActionError,
  changeEmail,
  changePassword,
  defaultVerificationEmailPath,
  eraseAccount,
  fetchUser,
  isCanceled,
  resendVerificationEmail,
  responseStatus,
  safePictureUrl,
  saveProductPreference,
  setPassword as setAccountPassword,
  toPublicError,
  updateProfile,
  userPaths,
  type UserRequest,
} from '../api';
import {
  languageLabel,
  languageOptions,
  matchesOption,
  timeZoneLabel,
  timeZoneOptions,
  uiLocale,
  type RegionOption,
} from '../regional';
import type { User, UserServiceProps } from '../types';

const defaultCardSx = {
  maxWidth: 720,
  width: { xs: 'calc(100% - 32px)', sm: '100%' },
  mx: 'auto',
  mt: 4,
};
const DELETED_MESSAGE = 'Your account has been deleted successfully';
const VERIFICATION_SENT_MESSAGE = 'Confirmation email sent.';
const verificationCooldownMs = 2 * 60 * 1000;

function verificationCooldownKey(userId: string): string {
  return `user-component-react:verification-email:${userId}`;
}

function readVerificationCooldown(userId: string): number {
  try {
    const until = Number(localStorage.getItem(verificationCooldownKey(userId)));
    return Number.isFinite(until) && until > Date.now() ? until : 0;
  } catch {
    return 0;
  }
}

function writeVerificationCooldown(userId: string, until: number): void {
  try {
    localStorage.setItem(verificationCooldownKey(userId), String(until));
  } catch {
    // The timer on this page still applies when storage is unavailable.
  }
}

function clearVerificationCooldown(userId: string): void {
  try {
    localStorage.removeItem(verificationCooldownKey(userId));
  } catch {
    // Storage can be unavailable in a private browser.
  }
}

function cooldownLabel(remainingMs: number): string {
  const totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `Resend in ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type UserEndpoint = Pick<UserServiceProps, 'apiUrl' | 'userId' | 'bearerToken' | 'authApiUrl'> & {
  getPath: string;
};

type ProfileView =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'deleted'; message: string }
  | { status: 'ready'; user: User };

interface ActionMessage {
  error: string | null;
  sent: boolean;
}

const emptyMessage: ActionMessage = { error: null, sent: false };

function requestOf(endpoint: UserEndpoint, signal: AbortSignal | null, path: string): UserRequest {
  return {
    apiUrl: endpoint.apiUrl,
    userId: endpoint.userId,
    bearerToken: endpoint.bearerToken,
    path,
    signal: signal ?? undefined,
  };
}

function displayLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function emailInitial(email: string): string {
  const initial = email.trim().charAt(0).toUpperCase();
  return initial || '?';
}

function useUserProfile({
  apiUrl,
  userId,
  bearerToken,
  getPath,
  onError,
}: UserEndpoint & Pick<UserServiceProps, 'onError'>) {
  const [view, setView] = useState<ProfileView>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const signalRef = useRef<AbortSignal | null>(null);
  const reportError = useEffectEvent((error: unknown, fallback: string) => {
    const publicError = toPublicError(error, fallback);
    onError?.(publicError);
    return publicError;
  });

  useEffect(() => {
    const controller = new AbortController();
    signalRef.current = controller.signal;
    let ignore = false;

    setView({ status: 'loading' });

    const load = async () => {
      try {
        const user = await fetchUser({ apiUrl, userId, bearerToken, path: getPath, signal: controller.signal });
        if (ignore) return;
        setView({ status: 'ready', user });
      } catch (error) {
        if (ignore || isCanceled(error)) return;
        const publicError = reportError(error, 'Unable to load the profile.');
        setView({ status: 'error', message: publicError.message });
      }
    };

    void load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [apiUrl, userId, bearerToken, getPath, attempt]);

  return { view, setView, signalRef, retry: () => setAttempt((value) => value + 1) };
}

export function UserService({
  apiUrl,
  userId,
  bearerToken,
  authApiUrl,
  linkOrigin,
  urls,
  onError,
  onSuccess,
  allowDelete = false,
  product,
  className,
  sx,
}: UserServiceProps) {
  const paths = userPaths(urls);
  const { view, setView, signalRef, retry } = useUserProfile({
    apiUrl,
    userId,
    bearerToken,
    getPath: paths.get,
    onError,
  });
  const endpoint: UserEndpoint = {
    apiUrl,
    userId,
    bearerToken,
    authApiUrl,
    getPath: paths.get,
  };
  const cardSx = (sx ? [defaultCardSx, sx] : defaultCardSx) as SxProps<Theme>;

  if (view.status === 'loading') {
    return <ProfileLoading />;
  }

  if (view.status === 'error') {
    return (
      <StatusCard className={className} sx={cardSx}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {view.message}
        </Alert>
        <Button type="button" variant="outlined" onClick={retry}>
          Retry
        </Button>
      </StatusCard>
    );
  }

  if (view.status === 'deleted') {
    return (
      <StatusCard className={className} sx={cardSx}>
        <Alert severity="success">{view.message}</Alert>
      </StatusCard>
    );
  }

  const { user } = view;

  return (
    <Card className={className} sx={cardSx}>
      <CardContent>
        <AccountCard
          user={user}
          endpoint={endpoint}
          product={product}
          signalRef={signalRef}
          allowDelete={allowDelete}
          authApiUrl={authApiUrl ?? apiUrl}
          verificationPath={urls?.verificationEmail ?? defaultVerificationEmailPath}
          linkOrigin={linkOrigin}
          onSaved={(next) => setView({ status: 'ready', user: next })}
          onDeleted={() => {
            setView({ status: 'deleted', message: DELETED_MESSAGE });
            onSuccess?.(DELETED_MESSAGE);
          }}
          onSuccess={onSuccess}
          onError={onError}
        />
      </CardContent>
    </Card>
  );
}

function ProfileLoading() {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}
    >
      <CircularProgress aria-label="Loading profile" />
    </Box>
  );
}

function StatusCard({ className, sx, children }: { className?: string; sx: SxProps<Theme>; children: ReactNode }) {
  return (
    <Card className={className} sx={sx}>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const PASSWORD_HINTS = new Set(['local', 'password', 'email', 'credentials']);
const SOCIAL_HINTS = new Set(['google', 'apple', 'facebook', 'github', 'oauth', 'oidc']);
const PASSWORD_UPDATED = 'Password updated. Other sessions have been signed out.';
const PASSWORD_SET = 'Password set. You can sign in with your email and this password.';

function accountHints(user: User): string[] {
  const providers = Array.isArray(user.authProviders) ? user.authProviders : [];
  const created = typeof user.createdVia === 'string' ? [user.createdVia] : [];
  return [...providers, ...created]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function accountUsesPassword(user: User): boolean {
  const hints = accountHints(user);
  if (hints.some((hint) => PASSWORD_HINTS.has(hint))) return true;
  if (hints.some((hint) => SOCIAL_HINTS.has(hint))) return false;
  return true;
}

function passwordIssue(password: string, email: string): string | null {
  if (password.length < 10 || password.length > 72) return 'Password must be 10–72 characters.';
  if (password.toLowerCase() === email.trim().toLowerCase()) return 'Password must not match your email.';
  return null;
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function AccountCard({
  user,
  endpoint,
  product,
  signalRef,
  allowDelete,
  authApiUrl,
  verificationPath,
  linkOrigin,
  onSaved,
  onDeleted,
  onSuccess,
  onError,
}: {
  user: User;
  endpoint: UserEndpoint;
  product?: 'grammarbar' | 'costy' | 'repeaty';
  signalRef: RefObject<AbortSignal | null>;
  allowDelete: boolean;
  authApiUrl: string;
  verificationPath: string;
  linkOrigin?: string;
  onSaved: (user: User) => void;
  onDeleted: () => void;
  onSuccess?: (message: string) => void;
  onError?: (error: Error) => void;
}) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [credential, setCredential] = useState<'password' | 'email' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [passwordReady, setPasswordReady] = useState(false);
  const usesPassword = passwordReady || accountUsesPassword(user);
  const unverified = user.emailVerified === false;
  const expandLabel = expanded ? 'Hide account details' : 'Show account details';

  const finish = (message: string) => {
    setNotice(message);
    setCredential(null);
    onSuccess?.(message);
  };

  return (
    <Stack spacing={2}>
      {notice && <Alert severity="success">{notice}</Alert>}
      <ProfileHeader
        user={user}
        action={
          <Tooltip title={expandLabel}>
            <IconButton
              type="button"
              aria-label={expandLabel}
              aria-expanded={expanded}
              aria-controls={expanded ? detailsId : undefined}
              onClick={() => {
                setExpanded((open) => {
                  if (open) setEditing(false);
                  return !open;
                });
              }}
              sx={{ flexShrink: 0, width: 40, height: 40 }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        }
      />
      {unverified && (
        <VerifyEmail
          endpoint={endpoint}
          authApiUrl={authApiUrl}
          verificationPath={verificationPath}
          linkOrigin={linkOrigin}
          signalRef={signalRef}
          onSent={() => onSuccess?.(VERIFICATION_SENT_MESSAGE)}
          onError={onError}
        />
      )}
      {expanded && (
        <Stack id={detailsId} spacing={2}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 40 }}>
              <Typography variant="subtitle2" component="h3">
                Profile
              </Typography>
              {!editing && (
                <Tooltip title="Edit profile">
                  <IconButton
                    type="button"
                    aria-label="Edit profile"
                    onClick={() => setEditing(true)}
                    sx={{ width: 40, height: 40 }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {editing ? (
              <ProfileEditor
                user={user}
                endpoint={endpoint}
                product={product}
                signalRef={signalRef}
                onCancel={() => setEditing(false)}
                onSaved={(next) => {
                  onSaved(next);
                  setNotice('Profile saved.');
                  setEditing(false);
                }}
                onError={onError}
              />
            ) : (
              <ProfileDetails user={user} />
            )}
          </Stack>
          <Divider />
          <Stack spacing={2}>
            <Typography variant="subtitle2" component="h3">
              Sign-in
            </Typography>
            <ProfileFacts user={user} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="outlined"
                startIcon={usesPassword ? <LockResetIcon /> : <LockOpenIcon />}
                onClick={() => setCredential('password')}
                sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
              >
                {usesPassword ? 'Change password' : 'Set password'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<MailOutlinedIcon />}
                onClick={() => setCredential('email')}
                sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
              >
                Change email
              </Button>
            </Box>
          </Stack>
          {allowDelete && (
            <>
              <Divider />
              <Button
                type="button"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteOpen(true)}
                sx={{ alignSelf: 'flex-start', width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
              >
                Delete account
              </Button>
            </>
          )}
        </Stack>
      )}
      {credential === 'password' && (
        <PasswordDialog
          user={user}
          endpoint={endpoint}
          authApiUrl={authApiUrl}
          signalRef={signalRef}
          initialMode={usesPassword ? 'change' : 'set'}
          onClose={() => setCredential(null)}
          onUsesPassword={() => setPasswordReady(true)}
          onDone={finish}
          onError={onError}
        />
      )}
      {credential === 'email' && (
        <EmailDialog
          user={user}
          endpoint={endpoint}
          authApiUrl={authApiUrl}
          linkOrigin={linkOrigin}
          signalRef={signalRef}
          askPassword={usesPassword}
          onClose={() => setCredential(null)}
          onUsesPassword={() => setPasswordReady(true)}
          onDone={finish}
          onError={onError}
        />
      )}
      {allowDelete && deleteOpen && (
        <DeleteProfileForm
          user={user}
          endpoint={endpoint}
          authApiUrl={authApiUrl}
          signalRef={signalRef}
          onClose={() => setDeleteOpen(false)}
          onDeleted={onDeleted}
          onError={onError}
        />
      )}
    </Stack>
  );
}

function shownOrUnset(value: string): string {
  return value.trim() || 'Not set';
}

function ProfileDetails({ user }: { user: User }) {
  const locale = uiLocale(user.locale);
  const language = user.locale?.trim() ? languageLabel(user.locale, locale) : '';
  const zone = user.timeZone?.trim() ? timeZoneLabel(user.timeZone, locale) : '';
  return (
    <DetailList>
      <Fact label="Display name">{shownOrUnset(user.displayName ?? '')}</Fact>
      <Fact label="Language">{shownOrUnset(language)}</Fact>
      <Fact label="Time zone">{shownOrUnset(zone)}</Fact>
    </DetailList>
  );
}

function RegionSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  group,
}: {
  label: string;
  options: RegionOption[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  group?: boolean;
}) {
  const selected = options.find((option) => option.id === value) ?? null;
  return (
    <Autocomplete
      options={options}
      value={selected}
      groupBy={group ? (option) => option.group ?? '' : undefined}
      onChange={(_event, option) => onChange(option?.id ?? '')}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      filterOptions={(available, state) => matchesOption(available, state.inputValue)}
      disabled={disabled}
      autoHighlight
      openOnFocus
      fullWidth
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

function ProfileEditor({
  user,
  endpoint,
  product,
  signalRef,
  onCancel,
  onSaved,
  onError,
}: {
  user: User;
  endpoint: UserEndpoint;
  product?: 'grammarbar' | 'costy' | 'repeaty';
  signalRef: RefObject<AbortSignal | null>;
  onCancel: () => void;
  onSaved: (user: User) => void;
  onError?: (error: Error) => void;
}) {
  const localeForLabels = uiLocale(user.locale);
  const languages = useMemo(() => languageOptions(localeForLabels, user.locale), [localeForLabels, user.locale]);
  const zones = useMemo(() => timeZoneOptions(localeForLabels, user.timeZone), [localeForLabels, user.timeZone]);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [locale, setLocale] = useState(user.locale ?? '');
  const [timeZone, setTimeZone] = useState(user.timeZone ?? '');
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await updateProfile(
        { ...endpoint, signal: signalRef.current ?? undefined },
        { displayName, locale, timeZone, avatarUrl: user.avatarUrl ?? undefined },
      );
      if (product) {
        await saveProductPreference({ ...endpoint, signal: signalRef.current ?? undefined }, product, marketing);
      }
      onSaved(next);
    } catch (caught) {
      const publicError = toPublicError(caught, 'Unable to save the profile.');
      setError(publicError.message);
      onError?.(publicError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      {error && <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>{error}</Alert>}
      <TextField
        label="Display name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        fullWidth
        disabled={saving}
        sx={{ gridColumn: '1 / -1' }}
      />
      <RegionSelect label="Language" options={languages} value={locale} onChange={setLocale} disabled={saving} />
      <RegionSelect label="Time zone" options={zones} value={timeZone} onChange={setTimeZone} disabled={saving} group />
      {product && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Button type="button" variant="text" onClick={() => setMarketing((current) => !current)} disabled={saving}>
            {marketing ? 'Product email on' : 'Product email off'}
          </Button>
        </Box>
      )}
      <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button type="button" variant="outlined" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}

function ProfileHeader({ user, action }: { user: User; action?: ReactNode }) {
  const picture = safePictureUrl(user.pictureUrl);
  const [failedPicture, setFailedPicture] = useState<string | null>(null);
  const verified = user.emailVerified === true;
  const unverified = user.emailVerified === false;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        <Avatar
          src={picture && failedPicture !== picture ? picture : undefined}
          alt=""
          onError={() => {
            if (picture) setFailedPicture(picture);
          }}
          sx={{ width: 56, height: 56, flexShrink: 0 }}
        >
          {emailInitial(user.email)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h2" sx={{ overflowWrap: 'anywhere', lineHeight: 1.3 }}>
            {user.displayName?.trim() || user.email}
          </Typography>
          {user.displayName?.trim() && (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {user.email}
            </Typography>
          )}
          {(verified || unverified) && (
            <Chip
              size="small"
              variant="outlined"
              color={verified ? 'success' : 'warning'}
              label={verified ? 'Verified' : 'Not verified'}
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      </Box>
      {action}
    </Box>
  );
}

function profileProviders(user: User): string[] {
  if (!Array.isArray(user.authProviders)) return [];
  return user.authProviders.filter((provider) => typeof provider === 'string' && provider.trim());
}

function ProfileFacts({ user }: { user: User }) {
  const createdVia = typeof user.createdVia === 'string' ? displayLabel(user.createdVia) : '';
  const providers = profileProviders(user);
  if (!createdVia && providers.length === 0) return null;

  return (
    <DetailList>
      {createdVia && <Fact label="Signed up">{createdVia}</Fact>}
      {providers.length > 0 && (
        <Fact label="Sign-in methods">
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {providers.map((provider) => (
              <Chip key={provider} label={displayLabel(provider)} size="small" variant="outlined" />
            ))}
          </Box>
        </Fact>
      )}
    </DetailList>
  );
}

function DetailList({ children }: { children: ReactNode }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        '& > :not(:last-child)': {
          borderBottom: 1,
          borderColor: 'divider',
        },
      }}
    >
      {children}
    </Box>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  const unset = children === 'Not set';
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(9.5rem, 32%) minmax(0, 1fr)' },
        columnGap: 3,
        rowGap: 0.25,
        alignItems: 'center',
        py: 1.5,
      }}
    >
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
        {typeof children === 'string' ? (
          <Typography variant="body1" color={unset ? 'text.secondary' : 'text.primary'} sx={{ fontWeight: unset ? 400 : 500 }}>
            {children}
          </Typography>
        ) : (
          children
        )}
      </Box>
    </Box>
  );
}

function authRequest(endpoint: UserEndpoint, authApiUrl: string, signalRef: RefObject<AbortSignal | null>): UserRequest {
  return {
    apiUrl: authApiUrl,
    userId: endpoint.userId,
    bearerToken: endpoint.bearerToken,
    signal: signalRef.current ?? undefined,
  };
}

function VerifyEmail({
  endpoint,
  authApiUrl,
  verificationPath,
  linkOrigin,
  signalRef,
  onSent,
  onError,
}: {
  endpoint: UserEndpoint;
  authApiUrl: string;
  verificationPath: string;
  linkOrigin?: string;
  signalRef: RefObject<AbortSignal | null>;
  onSent: () => void;
  onError?: (error: Error) => void;
}) {
  const [cooldownUntil, setCooldownUntil] = useState(() => readVerificationCooldown(endpoint.userId));
  const [announce, setAnnounce] = useState(() => readVerificationCooldown(endpoint.userId) > Date.now());
  const [now, setNow] = useState(() => Date.now());
  const remainingMs = Math.max(0, cooldownUntil - now);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;
    const id = window.setInterval(() => {
      const next = Date.now();
      if (next >= cooldownUntil) {
        window.clearInterval(id);
        clearVerificationCooldown(endpoint.userId);
        setCooldownUntil(0);
        setAnnounce(false);
        setNow(next);
        return;
      }
      setNow(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil, endpoint.userId]);

  const [resend, submitResend, resendPending] = useActionState(
    async (previous: ActionMessage): Promise<ActionMessage> => {
      const signal = signalRef.current;
      try {
        await resendVerificationEmail(
          {
            apiUrl: authApiUrl,
            userId: endpoint.userId,
            bearerToken: endpoint.bearerToken,
            path: verificationPath,
            signal: signal ?? undefined,
          },
          linkOrigin ?? window.location.origin,
        );
        if (signal?.aborted) return previous;
        const until = Date.now() + verificationCooldownMs;
        writeVerificationCooldown(endpoint.userId, until);
        setCooldownUntil(until);
        setNow(Date.now());
        setAnnounce(true);
        onSent();
        return { error: null, sent: true };
      } catch (error) {
        if (isCanceled(error) || signal?.aborted) return previous;
        const publicError = toPublicError(error, 'Unable to send the confirmation email.');
        onError?.(publicError);
        return { error: publicError.message, sent: false };
      }
    },
    emptyMessage,
  );

  return (
    <Stack spacing={1}>
      {announce && <Alert severity="success">{VERIFICATION_SENT_MESSAGE}</Alert>}
      {resend.error && <Alert severity="error">{resend.error}</Alert>}
      <Box component="form" action={submitResend} sx={{ alignSelf: 'flex-start', width: { xs: '100%', sm: 'auto' } }}>
        <Button
          type="submit"
          variant="outlined"
          startIcon={resendPending ? <CircularProgress size={16} color="inherit" /> : <ForwardToInboxIcon />}
          disabled={resendPending || remainingMs > 0}
          sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
        >
          {resendPending ? 'Sending...' : remainingMs > 0 ? cooldownLabel(remainingMs) : 'Verify email'}
        </Button>
      </Box>
    </Stack>
  );
}

function PasswordDialog({
  user,
  endpoint,
  authApiUrl,
  signalRef,
  initialMode,
  onClose,
  onUsesPassword,
  onDone,
  onError,
}: {
  user: User;
  endpoint: UserEndpoint;
  authApiUrl: string;
  signalRef: RefObject<AbortSignal | null>;
  initialMode: 'change' | 'set';
  onClose: () => void;
  onUsesPassword: () => void;
  onDone: (message: string) => void;
  onError?: (error: Error) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [mode, setMode] = useState(initialMode);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready =
    passwordIssue(password, user.email) === null &&
    password === confirm &&
    (mode === 'set' || currentPassword.length > 0);
  const close = () => {
    if (!pending) onClose();
  };
  const title = mode === 'set' ? 'Set password' : 'Change password';

  const submit = async () => {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    const request = authRequest(endpoint, authApiUrl, signalRef);
    try {
      if (mode === 'set') {
        await setAccountPassword(request, password);
        onUsesPassword();
        setPending(false);
        if (!request.signal?.aborted) onDone(PASSWORD_SET);
      } else {
        await changePassword(request, currentPassword, password);
        setPending(false);
        if (!request.signal?.aborted) onDone(PASSWORD_UPDATED);
      }
    } catch (caught) {
      if (isCanceled(caught) || request.signal?.aborted) return;
      if (mode === 'set' && responseStatus(caught) === 409) {
        setMode('change');
        onUsesPassword();
        setError('This account already has a password.');
        setPending(false);
        return;
      }
      const publicError = accountActionError(caught, mode === 'set' ? 'Unable to set the password.' : 'Unable to change the password.', {
        401: 'Current password is incorrect.',
      });
      setError(publicError.message);
      onError?.(publicError);
      setPending(false);
    }
  };

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby={titleId} aria-describedby={descriptionId}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText id={descriptionId}>
            {mode === 'set'
              ? 'Add a password so you can also sign in with your email.'
              : 'Choose a new password. Other signed-in sessions will be signed out.'}
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {mode === 'change' && (
            <TextField
              autoFocus
              margin="dense"
              label="Current password"
              type="password"
              fullWidth
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={pending}
              autoComplete="current-password"
              required
              sx={{ mt: 2 }}
            />
          )}
          <TextField
            autoFocus={mode === 'set'}
            margin="dense"
            label="New password"
            type="password"
            fullWidth
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            autoComplete="new-password"
            required
            helperText="10–72 characters. It cannot match your email."
            sx={{ mt: mode === 'set' ? 2 : undefined }}
          />
          <TextField
            margin="dense"
            label="Confirm new password"
            type="password"
            fullWidth
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={pending}
            autoComplete="new-password"
            required
            error={mismatch}
            helperText={mismatch ? 'Passwords do not match.' : undefined}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={pending || !ready}>
            {pending ? 'Saving...' : title}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function EmailDialog({
  user,
  endpoint,
  authApiUrl,
  linkOrigin,
  signalRef,
  askPassword,
  onClose,
  onUsesPassword,
  onDone,
  onError,
}: {
  user: User;
  endpoint: UserEndpoint;
  authApiUrl: string;
  linkOrigin?: string;
  signalRef: RefObject<AbortSignal | null>;
  askPassword: boolean;
  onClose: () => void;
  onUsesPassword: () => void;
  onDone: (message: string) => void;
  onError?: (error: Error) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(askPassword);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const trimmed = email.trim();
  const same = trimmed.length > 0 && trimmed.toLowerCase() === user.email.trim().toLowerCase();
  const ready = isEmailAddress(trimmed) && !same && (!needsPassword || password.length > 0);
  const close = () => {
    if (!pending) onClose();
  };

  const submit = async () => {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    const request = authRequest(endpoint, authApiUrl, signalRef);
    try {
      await changeEmail(
        request,
        trimmed,
        linkOrigin ?? window.location.origin,
        needsPassword ? password : undefined,
      );
      setPending(false);
      if (!request.signal?.aborted) {
        onDone(
          `Confirmation link sent to ${trimmed}. ${user.email} stays on this account until you open the link.`,
        );
      }
    } catch (caught) {
      if (isCanceled(caught) || request.signal?.aborted) return;
      if (!needsPassword && responseStatus(caught) === 401) {
        setNeedsPassword(true);
        onUsesPassword();
        setError('Enter your current password to confirm this change.');
        setPending(false);
        return;
      }
      const publicError = accountActionError(caught, 'Unable to change the email.', {
        401: 'Current password is incorrect.',
        409: 'An account with that email already exists.',
      });
      setError(publicError.message);
      onError?.(publicError);
      setPending(false);
    }
  };

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby={titleId} aria-describedby={descriptionId}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id={titleId}>Change email</DialogTitle>
        <DialogContent>
          <DialogContentText id={descriptionId}>
            We'll email a confirmation link to the new address. <strong>{user.email}</strong> stays on this account until
            you open that link.
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="New email"
            type="email"
            fullWidth
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            autoComplete="email"
            required
            error={same}
            helperText={same ? 'That is already your email address.' : undefined}
            sx={{ mt: 2 }}
          />
          {needsPassword && (
            <TextField
              margin="dense"
              label="Current password"
              type="password"
              fullWidth
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              autoComplete="current-password"
              required
              helperText="Required to confirm this change."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={pending || !ready}>
            {pending ? 'Sending...' : 'Send confirmation link'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface DeleteResult {
  error: string | null;
  submittedEmail: string;
}

function DeleteProfileForm({
  user,
  endpoint,
  authApiUrl,
  signalRef,
  onClose,
  onDeleted,
  onError,
}: {
  user: User;
  endpoint: UserEndpoint;
  authApiUrl: string;
  signalRef: RefObject<AbortSignal | null>;
  onClose: () => void;
  onDeleted: () => void;
  onError?: (error: Error) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [email, setEmail] = useState('');
  const [result, submit, pending] = useActionState(
    async (_previous: DeleteResult, formData: FormData): Promise<DeleteResult> => {
      const submittedEmail = String(formData.get('email') ?? '').trim();
      if (submittedEmail !== user.email.trim()) {
        return {
          error: 'Email does not match. Please enter your email address to confirm deletion.',
          submittedEmail,
        };
      }

      const signal = signalRef.current;
      const password = String(formData.get('password') ?? '');
      try {
        await eraseAccount(
          { ...requestOf(endpoint, signal, '/account/erase'), apiUrl: authApiUrl },
          password,
        );
        if (!signal?.aborted) onDeleted();
        return { error: null, submittedEmail };
      } catch (error) {
        if (isCanceled(error) || signal?.aborted) return { error: null, submittedEmail };
        const publicError = toPublicError(error, 'Unable to delete the account.');
        onError?.(publicError);
        return { error: publicError.message, submittedEmail };
      }
    },
    { error: null, submittedEmail: '' },
  );
  const deleteError = email.trim() === result.submittedEmail ? result.error : null;
  const close = () => {
    if (!pending) onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      maxWidth="sm"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <form action={submit}>
        <DialogTitle id={titleId}>Delete account</DialogTitle>
        <DialogContent>
          <DialogContentText id={descriptionId}>
            This permanently erases the sign-in account. Enter <strong>{user.email}</strong> to confirm.
            If you sign in with a password, enter that too.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            name="email"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            autoComplete="off"
            required
            error={Boolean(deleteError)}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            name="password"
            fullWidth
            variant="outlined"
            disabled={pending}
            autoComplete="current-password"
            helperText="Required when this account has a password."
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            color="error"
            variant="contained"
            disabled={pending || email.trim().length === 0}
            startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {pending ? 'Deleting...' : 'Delete account'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
