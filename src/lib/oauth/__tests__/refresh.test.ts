import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { needsRefresh, refreshAccessToken } from '../refresh'
import type { OAuthProviderConfig } from '../config'

const MOCK_CONFIG: OAuthProviderConfig = {
  clientId: 'id',
  clientSecret: 'secret',
  authorizationUrl: '',
  tokenUrl: 'https://sentry.io/oauth/token/',
  scopes: [],
  redirectUri: '',
  supportsRefresh: true,
}

describe('needsRefresh', () => {
  it('returns false when expires_at is null', () => {
    expect(needsRefresh(null)).toBe(false)
  })

  it('returns false when token expires far in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    expect(needsRefresh(future)).toBe(false)
  })

  it('returns true when token expires within 10 minutes', () => {
    const soon = Math.floor(Date.now() / 1000) + 300
    expect(needsRefresh(soon)).toBe(true)
  })

  it('returns true when token is already expired', () => {
    const past = Math.floor(Date.now() / 1000) - 60
    expect(needsRefresh(past)).toBe(true)
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns new tokens on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-act',
        refresh_token: 'new-rft',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    } as Response)

    const tokens = await refreshAccessToken('old-refresh-token', MOCK_CONFIG)
    expect(tokens.access_token).toBe('new-act')
    expect(tokens.refresh_token).toBe('new-rft')
    expect(tokens.expires_at).toBeGreaterThan(Date.now() / 1000)
  })

  it('keeps old refresh_token when provider does not return a new one', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-act', expires_in: 3600, token_type: 'bearer' }),
    } as Response)

    const tokens = await refreshAccessToken('original-rft', MOCK_CONFIG)
    expect(tokens.refresh_token).toBe('original-rft')
  })

  it('throws on HTTP error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    await expect(refreshAccessToken('bad-token', MOCK_CONFIG)).rejects.toThrow('Token refresh failed')
  })
})
