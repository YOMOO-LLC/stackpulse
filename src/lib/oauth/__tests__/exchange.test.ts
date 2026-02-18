import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { exchangeCodeForToken } from '../exchange'
import type { OAuthProviderConfig } from '../config'

const MOCK_CONFIG: OAuthProviderConfig = {
  clientId: 'client-id',
  clientSecret: 'secret',
  authorizationUrl: 'https://example.com/authorize',
  tokenUrl: 'https://example.com/token',
  scopes: ['read'],
  redirectUri: 'http://localhost:4567/api/oauth/callback/test',
  supportsRefresh: true,
}

describe('exchangeCodeForToken', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns tokens on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'act-123',
        refresh_token: 'rft-456',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    } as Response)

    const tokens = await exchangeCodeForToken('code-abc', MOCK_CONFIG)
    expect(tokens.access_token).toBe('act-123')
    expect(tokens.refresh_token).toBe('rft-456')
    expect(tokens.expires_at).toBeGreaterThan(Date.now() / 1000)
  })

  it('sets expires_at to null when no expires_in', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'act', token_type: 'bearer' }),
    } as Response)

    const tokens = await exchangeCodeForToken('code', MOCK_CONFIG)
    expect(tokens.expires_at).toBeNull()
    expect(tokens.refresh_token).toBeNull()
  })

  it('throws on HTTP error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 400 } as Response)
    await expect(exchangeCodeForToken('bad-code', MOCK_CONFIG)).rejects.toThrow('Token exchange failed')
  })

  it('throws on OAuth error in response body', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'bad_verification_code' }),
    } as Response)
    await expect(exchangeCodeForToken('bad-code', MOCK_CONFIG)).rejects.toThrow('OAuth error')
  })
})
