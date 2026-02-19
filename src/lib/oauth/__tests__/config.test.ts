import { describe, it, expect, beforeEach } from 'vitest'

describe('getOAuthConfig', () => {
  beforeEach(() => {
    process.env.GITHUB_CLIENT_ID = 'gh-client-id'
    process.env.GITHUB_CLIENT_SECRET = 'gh-secret'
    process.env.VERCEL_CLIENT_ID = 'v-client-id'
    process.env.VERCEL_CLIENT_SECRET = 'v-secret'
    process.env.SENTRY_CLIENT_ID = 's-client-id'
    process.env.SENTRY_CLIENT_SECRET = 's-secret'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:4567'
  })

  it('returns GitHub config', async () => {
    const { getOAuthConfig } = await import('../config')
    const config = getOAuthConfig('github')
    expect(config).not.toBeNull()
    expect(config!.authorizationUrl).toContain('github.com')
    expect(config!.scopes).toContain('user')
    expect(config!.redirectUri).toContain('/api/oauth/callback/github')
  })

  it('returns Vercel config', async () => {
    const { getOAuthConfig } = await import('../config')
    const config = getOAuthConfig('vercel')
    expect(config).not.toBeNull()
    expect(config!.authorizationUrl).toContain('vercel.com')
  })

  it('returns Sentry config with refresh scopes', async () => {
    const { getOAuthConfig } = await import('../config')
    const config = getOAuthConfig('sentry')
    expect(config).not.toBeNull()
    expect(config!.scopes).toContain('project:read')
    expect(config!.supportsRefresh).toBe(true)
  })

  it('returns null for unknown provider', async () => {
    const { getOAuthConfig } = await import('../config')
    expect(getOAuthConfig('unknown')).toBeNull()
  })
})
