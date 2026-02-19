import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchGitHubMetrics } from '../github'

describe('fetchGitHubMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns rate limit data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        resources: { core: { limit: 5000, remaining: 4200, used: 800, reset: 1234567890 } },
      }),
    } as Response)
    const result = await fetchGitHubMetrics('ghp_xxx')
    expect(result.rateLimitRemaining).toBe(4200)
    expect(result.rateLimitUsed).toBe(800)
    expect(result.rateLimitTotal).toBe(5000)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when usage > 80%', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        resources: { core: { limit: 5000, remaining: 800, used: 4200, reset: 1234567890 } },
      }),
    } as Response)
    const result = await fetchGitHubMetrics('ghp_xxx')
    expect(result.status).toBe('warning')
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await fetchGitHubMetrics('bad-token')
    expect(result.status).toBe('unknown')
  })
})
