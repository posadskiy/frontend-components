import type { AuthLabels } from '../labels';
import type { OAuthProvider, OAuthProviderOption } from '../types';

const KNOWN_PROVIDERS: OAuthProvider[] = ['apple', 'google', 'facebook', 'microsoft', 'github', 'discord'];

export interface ResolvedProvider {
  id: OAuthProvider;
  label: string;
}

export function resolveProviders(
  options: {
    enableOAuth?: boolean;
    providers?: OAuthProviderOption[];
    enableGoogle?: boolean;
    enableFacebook?: boolean;
    enableApple?: boolean;
    enableMicrosoft?: boolean;
    enableGithub?: boolean;
    enableDiscord?: boolean;
  },
  mode: 'login' | 'register',
  labels: AuthLabels,
): ResolvedProvider[] {
  if (options.enableOAuth === false) return [];

  const labelFor = (id: OAuthProvider, custom?: string) => {
    if (custom) return custom;
    return mode === 'register' ? labels.registerProvider[id] : labels.provider[id];
  };

  if (options.providers) {
    return options.providers.map((entry) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      const custom = typeof entry === 'string' ? undefined : entry.label;
      if (!KNOWN_PROVIDERS.includes(id)) {
        throw new Error(`Unsupported OAuth provider: ${id}`);
      }
      return { id, label: labelFor(id, custom) };
    });
  }

  const flags: Record<OAuthProvider, boolean | undefined> = {
    apple: options.enableApple,
    google: options.enableGoogle,
    facebook: options.enableFacebook,
    microsoft: options.enableMicrosoft,
    github: options.enableGithub,
    discord: options.enableDiscord,
  };

  return KNOWN_PROVIDERS.filter((id) => flags[id]).map((id) => ({ id, label: labelFor(id) }));
}
