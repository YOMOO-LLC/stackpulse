import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchStripeMetrics, stripeProvider } from '../stripe'

describe('fetchStripeMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns account balance', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ available: [{ amount: 150000, currency: 'usd' }] }),
    } as Response)
    const result = await fetchStripeMetrics('sk_test_xxx')
    expect(result.balance).toBe(1500.00)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when balance < $100', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ available: [{ amount: 5000, currency: 'usd' }] }),
    } as Response)
    const result = await fetchStripeMetrics('sk_test_xxx')
    expect(result.balance).toBe(50.00)
    expect(result.status).toBe('warning')
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await fetchStripeMetrics('bad-key')
    expect(result.status).toBe('unknown')
  })
})

describe('stripeProvider.fetchMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('delegates to fetchStripeMetrics and returns SnapshotResult', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: [{ amount: 5000, currency: 'usd' }] }),
    } as Response)

    const results = await stripeProvider.fetchMetrics!({ apiKey: 'sk_test_xxx' })
    expect(results).toHaveLength(1)
    expect(results[0].collectorId).toBe('account_balance')
    expect(results[0].value).toBe(50)
  })
})
