import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchGitHubMetrics } from '../github'

const RATE_LIMIT_RESPONSE = {
  resources: {
    core: { limit: 5000, remaining: 4200, used: 800, reset: 1234567890 },
    graphql: { limit: 5000, remaining: 4900, used: 100, reset: 1234567890 },
    search: { limit: 30, remaining: 28, used: 2, reset: 1234567890 },
  },
}

const USER_RESPONSE = { public_repos: 42, login: 'testuser' }

describe('fetchGitHubMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns all rate limit and user data', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => RATE_LIMIT_RESPONSE } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => USER_RESPONSE } as Response)

    const result = await fetchGitHubMetrics('ghp_xxx')
    expect(result.rateLimitRemaining).toBe(4200)
    expect(result.rateLimitUsed).toBe(800)
    expect(result.graphqlRemaining).toBe(4900)
    expect(result.searchRemaining).toBe(28)
    expect(result.publicRepos).toBe(42)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when core usage > 80%', async () => {
    const highUsage = { resources: { core: { limit: 5000, remaining: 800, used: 4200, reset: 0 }, graphql: { limit: 5000, remaining: 5000, used: 0, reset: 0 }, search: { limit: 30, remaining: 30, used: 0, reset: 0 } } }
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => highUsage } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => USER_RESPONSE } as Response)

    const result = await fetchGitHubMetrics('ghp_xxx')
    expect(result.status).toBe('warning')
  })

  it('still returns rate limit data when user endpoint fails', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => RATE_LIMIT_RESPONSE } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)

    const result = await fetchGitHubMetrics('ghp_xxx')
    expect(result.rateLimitRemaining).toBe(4200)
    expect(result.publicRepos).toBeNull()
    expect(result.status).toBe('healthy')
  })

  it('returns unknown on rate limit API error', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)

    const result = await fetchGitHubMetrics('bad-token')
    expect(result.status).toBe('unknown')
  })
})
