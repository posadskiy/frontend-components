import { Alert, Button, Stack } from '@mantine/core';
import type { OAuthProvider } from '../types';
import { providerButtonProps, providerIcons } from '../oauth/providers';
import type { ResolvedProvider } from '../oauth/resolveProviders';

export function OAuthButtons({
  providers,
  activeProvider,
  disabled,
  error,
  onSelect,
}: {
  providers: ResolvedProvider[];
  activeProvider: OAuthProvider | null;
  disabled: boolean;
  error: string | null;
  onSelect: (provider: OAuthProvider) => void;
}) {
  if (providers.length === 0) return null;

  return (
    <Stack gap="sm" mb="xl">
      {providers.map((provider) => {
        const appearance = providerButtonProps(provider.id);
        const isActive = activeProvider === provider.id;
        return (
          <Button
            key={provider.id}
            type="button"
            variant={appearance.variant}
            color={appearance.color}
            fullWidth
            radius="md"
            onClick={() => onSelect(provider.id)}
            loading={isActive}
            disabled={disabled || (activeProvider !== null && !isActive)}
            leftSection={providerIcons[provider.id]}
          >
            {provider.label}
          </Button>
        );
      })}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
