import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchOpenAIMetrics } from '../openai'

describe('fetchOpenAIMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns credit balance and monthly usage', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ grants: { data: [{ grant_amount: 100, used_amount: 20 }] } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_usage: 3500 }), // in cents
      } as Response)
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.creditBalance).toBeCloseTo(80)
    expect(result.monthlyUsage).toBeCloseTo(35)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when credit balance < $5', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ grants: { data: [{ grant_amount: 10, used_amount: 6 }] } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_usage: 100 }),
      } as Response)
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.status).toBe('warning')
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await fetchOpenAIMetrics('bad-key')
    expect(result.status).toBe('unknown')
  })
})
