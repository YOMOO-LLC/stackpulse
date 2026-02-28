import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  }),
}))

vi.mock('@/lib/oauth/state', () => ({
  generateState: vi.fn().mockReturnValue('test-state-123'),
  setStateCookie: vi.fn().mockResolvedValue(undefined),
  setLabelCookie: vi.fn().mockResolvedValue(undefined),
  setCodeVerifierCookie: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/oauth/config', () => ({
  getOAuthConfig: vi.fn().mockReturnValue({
    clientId: 'gh-client-id',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    scopes: ['read:user'],
    redirectUri: 'http://localhost:4567/api/oauth/callback/github',
    supportsRefresh: false,
    requiresPKCE: false,
  }),
}))

import { GET } from '../route'

function makeRequest(provider: string, label?: string) {
  const url = `http://localhost:4567/api/oauth/authorize/${provider}${label ? `?label=${label}` : ''}`
  return new Request(url)
}

describe('GET /api/oauth/authorize/[provider]', () => {
  it('redirects to provider authorization URL', async () => {
    const res = await GET(makeRequest('github') as never, { params: Promise.resolve({ provider: 'github' }) })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('github.com/login/oauth/authorize')
  })

  it('includes state in redirect URL', async () => {
    const res = await GET(makeRequest('github') as never, { params: Promise.resolve({ provider: 'github' }) })
    expect(res.headers.get('location')).toContain('state=test-state-123')
  })

  it('includes response_type=code in redirect URL', async () => {
    const res = await GET(makeRequest('github') as never, { params: Promise.resolve({ provider: 'github' }) })
    expect(res.headers.get('location')).toContain('response_type=code')
  })

  it('returns 400 for unknown provider', async () => {
    const { getOAuthConfig } = await import('@/lib/oauth/config')
    vi.mocked(getOAuthConfig).mockReturnValueOnce(null)
    const res = await GET(makeRequest('unknown') as never, { params: Promise.resolve({ provider: 'unknown' }) })
    expect(res.status).toBe(400)
  })

  it('includes code_challenge and code_challenge_method when requiresPKCE', async () => {
    const { getOAuthConfig } = await import('@/lib/oauth/config')
    vi.mocked(getOAuthConfig).mockReturnValueOnce({
      clientId: 'v-client-id',
      authorizationUrl: 'https://vercel.com/oauth/authorize',
      scopes: [],
      redirectUri: 'http://localhost:4567/api/oauth/callback/vercel',
      supportsRefresh: false,
      requiresPKCE: true,
      tokenUrl: 'https://api.vercel.com/login/oauth/token',
      clientSecret: 'v-secret',
    })
    const res = await GET(makeRequest('vercel') as never, { params: Promise.resolve({ provider: 'vercel' }) })
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('code_challenge=')
    expect(location).toContain('code_challenge_method=S256')
  })

  it('code_challenge is valid base64url SHA-256 when requiresPKCE', async () => {
    const { getOAuthConfig } = await import('@/lib/oauth/config')
    vi.mocked(getOAuthConfig).mockReturnValueOnce({
      clientId: 'v-client-id',
      authorizationUrl: 'https://vercel.com/oauth/authorize',
      scopes: [],
      redirectUri: 'http://localhost:4567/api/oauth/callback/vercel',
      supportsRefresh: false,
      requiresPKCE: true,
      tokenUrl: 'https://api.vercel.com/login/oauth/token',
      clientSecret: 'v-secret',
    })
    const res = await GET(makeRequest('vercel') as never, { params: Promise.resolve({ provider: 'vercel' }) })
    const location = res.headers.get('location') ?? ''
    const parsed = new URL(location)
    const challenge = parsed.searchParams.get('code_challenge') ?? ''
    // SHA-256 base64url is 43 chars (256 bits / 6 bits per char, url-safe, no padding)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('does not include code_challenge when not requiresPKCE', async () => {
    const res = await GET(makeRequest('github') as never, { params: Promise.resolve({ provider: 'github' }) })
    const location = res.headers.get('location') ?? ''
    expect(location).not.toContain('code_challenge')
  })

  it('redirects unauthenticated users to /login', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)
    const res = await GET(makeRequest('github') as never, { params: Promise.resolve({ provider: 'github' }) })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
