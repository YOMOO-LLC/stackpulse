import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/oauth/state', () => ({
  verifyStateCookie: vi.fn().mockResolvedValue(true),
  getLabelCookie: vi.fn().mockResolvedValue('My GitHub'),
}))
vi.mock('@/lib/oauth/config', () => ({
  getOAuthConfig: vi.fn().mockReturnValue({
    clientId: 'id', clientSecret: 'secret',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    redirectUri: 'http://localhost/api/oauth/callback/github',
    scopes: [], supportsRefresh: false,
  }),
}))
vi.mock('@/lib/oauth/exchange', () => ({
  exchangeCodeForToken: vi.fn().mockResolvedValue({
    access_token: 'act', refresh_token: null, expires_at: null, token_type: 'bearer',
  }),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn().mockReturnValue('encrypted'),
}))
vi.mock('@/lib/providers', () => ({
  getProvider: vi.fn().mockReturnValue({ id: 'github', name: 'GitHub' }),
}))
vi.mock('@/lib/qstash', () => ({
  registerServiceSchedule: vi.fn().mockResolvedValue('qs-123'),
}))

import { createClient } from '@/lib/supabase/server'
import { GET } from '../route'

function makeCallbackRequest(provider: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/oauth/callback/${provider}`)
  Object.entries({ code: 'test-code', state: 'test-state', ...params }).forEach(
    ([k, v]) => url.searchParams.set(k, v)
  )
  return new Request(url.toString())
}

const MOCK_DB = {
  from: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'svc-new' }, error: null }),
  }),
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
}

describe('GET /api/oauth/callback/[provider]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(MOCK_DB as never)
  })

  it('redirects to /dashboard on success', async () => {
    const res = await GET(makeCallbackRequest('github') as never, {
      params: Promise.resolve({ provider: 'github' })
    })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('redirects to /connect on error=access_denied', async () => {
    const res = await GET(
      makeCallbackRequest('github', { error: 'access_denied', code: '', state: '' }) as never,
      { params: Promise.resolve({ provider: 'github' }) }
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/connect')
  })

  it('redirects to /connect/[provider]?error=oauth_failed on invalid state', async () => {
    const { verifyStateCookie } = await import('@/lib/oauth/state')
    vi.mocked(verifyStateCookie).mockResolvedValueOnce(false)
    const res = await GET(makeCallbackRequest('github') as never, {
      params: Promise.resolve({ provider: 'github' })
    })
    expect(res.headers.get('location')).toContain('oauth_failed')
  })
})
