export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
  redirectUri: string
  supportsRefresh: boolean
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'
}

export function getOAuthConfig(providerId: string): OAuthProviderConfig | null {
  const appUrl = getAppUrl()

  const configs: Record<string, OAuthProviderConfig> = {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['read:user'],
      redirectUri: `${appUrl}/api/oauth/callback/github`,
      supportsRefresh: false,
    },
    vercel: {
      clientId: process.env.VERCEL_CLIENT_ID ?? '',
      clientSecret: process.env.VERCEL_CLIENT_SECRET ?? '',
      authorizationUrl: 'https://vercel.com/oauth/authorize',
      tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
      scopes: [],
      redirectUri: `${appUrl}/api/oauth/callback/vercel`,
      supportsRefresh: false,
    },
    sentry: {
      clientId: process.env.SENTRY_CLIENT_ID ?? '',
      clientSecret: process.env.SENTRY_CLIENT_SECRET ?? '',
      authorizationUrl: 'https://sentry.io/oauth/authorize/',
      tokenUrl: 'https://sentry.io/oauth/token/',
      scopes: ['project:read', 'org:read', 'event:read'],
      redirectUri: `${appUrl}/api/oauth/callback/sentry`,
      supportsRefresh: true,
    },
  }

  return configs[providerId] ?? null
}
