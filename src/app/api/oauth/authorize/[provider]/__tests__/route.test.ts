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
}))

vi.mock('@/lib/oauth/config', () => ({
  getOAuthConfig: vi.fn().mockReturnValue({
    clientId: 'gh-client-id',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    scopes: ['read:user'],
    redirectUri: 'http://localhost:4567/api/oauth/callback/github',
    supportsRefresh: false,
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

  it('returns 400 for unknown provider', async () => {
    const { getOAuthConfig } = await import('@/lib/oauth/config')
    vi.mocked(getOAuthConfig).mockReturnValueOnce(null)
    const res = await GET(makeRequest('unknown') as never, { params: Promise.resolve({ provider: 'unknown' }) })
    expect(res.status).toBe(400)
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
