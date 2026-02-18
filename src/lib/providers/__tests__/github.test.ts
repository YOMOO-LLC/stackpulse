import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchGitHubMetrics } from '../github'

describe('fetchGitHubMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns actions minutes data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ total_minutes_used: 800, included_minutes: 2000 }),
    } as Response)
    const result = await fetchGitHubMetrics('ghp_xxx')
    expect(result.minutesUsed).toBe(800)
    expect(result.minutesLimit).toBe(2000)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when usage > 80%', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ total_minutes_used: 1800, included_minutes: 2000 }),
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
