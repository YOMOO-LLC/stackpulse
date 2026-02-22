import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchStripeMetrics, stripeProvider } from '../stripe'
import type { StripeMetricResult } from '../stripe'

// --- Mock helpers ---

const mockBalance = (amountCents: number) =>
  ({
    ok: true,
    json: async () => ({ available: [{ amount: amountCents, currency: 'usd' }] }),
  }) as Response

const mockCharges = (charges: Array<{ amount: number }>) =>
  ({
    ok: true,
    json: async () => ({
      data: charges.map((c, i) => ({ id: `ch_${i}`, amount: c.amount, status: 'succeeded' })),
      has_more: false,
    }),
  }) as Response

const mockDisputes = (disputes: Array<{ status: string; amount: number }>) =>
  ({
    ok: true,
    json: async () => ({
      data: disputes.map((d, i) => ({ id: `dp_${i}`, status: d.status, amount: d.amount })),
      has_more: false,
    }),
  }) as Response

const mockSubscriptions = (subs: Array<{ amount: number; interval?: string }>) =>
  ({
    ok: true,
    json: async () => ({
      data: subs.map((s, i) => ({
        id: `sub_${i}`,
        status: 'active',
        plan: { amount: s.amount, interval: s.interval ?? 'month' },
      })),
      has_more: false,
    }),
  }) as Response

/** Set up all 4 API call mocks in order: balance, charges, disputes, subscriptions */
function mockAllApis(opts: {
  balanceCents?: number
  charges?: Array<{ amount: number }>
  disputes?: Array<{ status: string; amount: number }>
  subscriptions?: Array<{ amount: number; interval?: string }>
}) {
  const f = vi.mocked(global.fetch)
  f.mockResolvedValueOnce(mockBalance(opts.balanceCents ?? 150000))
  f.mockResolvedValueOnce(mockCharges(opts.charges ?? []))
  f.mockResolvedValueOnce(mockDisputes(opts.disputes ?? []))
  f.mockResolvedValueOnce(mockSubscriptions(opts.subscriptions ?? []))
}

describe('fetchStripeMetrics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns all 4 metrics correctly', async () => {
    mockAllApis({
      balanceCents: 1245000,
      charges: [{ amount: 500000 }, { amount: 392000 }],
      disputes: [{ status: 'needs_response', amount: 34000 }],
      subscriptions: [{ amount: 4900 }, { amount: 9900 }],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.balance).toBe(12450)
    expect(result.charges24h).toBe(2)
    expect(result.chargesVolume24h).toBe(8920)
    expect(result.activeDisputes).toBe(1)
    expect(result.disputeAmount).toBe(340)
    expect(result.activeSubscriptions).toBe(2)
    expect(result.monthlyRecurringRevenue).toBe(148)
  })

  it('counts only active disputes (warning_needs_response, needs_response, under_review)', async () => {
    mockAllApis({
      disputes: [
        { status: 'needs_response', amount: 10000 },
        { status: 'warning_needs_response', amount: 20000 },
        { status: 'under_review', amount: 30000 },
        { status: 'won', amount: 50000 },
        { status: 'lost', amount: 60000 },
        { status: 'charge_refunded', amount: 70000 },
      ],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.activeDisputes).toBe(3)
    expect(result.disputeAmount).toBe(600) // (10000+20000+30000)/100
  })

  it('calculates charges volume correctly', async () => {
    mockAllApis({
      charges: [
        { amount: 100000 }, // $1000
        { amount: 250000 }, // $2500
        { amount: 50000 },  // $500
      ],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.charges24h).toBe(3)
    expect(result.chargesVolume24h).toBe(4000) // (100000+250000+50000)/100
  })

  it('calculates MRR correctly with monthly and yearly plans', async () => {
    mockAllApis({
      subscriptions: [
        { amount: 4900, interval: 'month' },  // $49/month
        { amount: 12000, interval: 'year' },   // $120/year = $10/month
        { amount: 9900, interval: 'month' },   // $99/month
      ],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.activeSubscriptions).toBe(3)
    expect(result.monthlyRecurringRevenue).toBe(158) // 49 + 10 + 99
  })

  it('returns status warning when active disputes > 0', async () => {
    mockAllApis({
      balanceCents: 500000, // $5000, above threshold
      disputes: [{ status: 'needs_response', amount: 10000 }],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.status).toBe('warning')
  })

  it('returns status warning when balance < $100', async () => {
    mockAllApis({
      balanceCents: 5000, // $50
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.status).toBe('warning')
  })

  it('returns status critical when disputes >= 5', async () => {
    mockAllApis({
      disputes: [
        { status: 'needs_response', amount: 1000 },
        { status: 'needs_response', amount: 1000 },
        { status: 'warning_needs_response', amount: 1000 },
        { status: 'under_review', amount: 1000 },
        { status: 'needs_response', amount: 1000 },
      ],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.status).toBe('critical')
  })

  it('returns status healthy when no issues', async () => {
    mockAllApis({
      balanceCents: 500000, // $5000
      disputes: [],
    })

    const result = await fetchStripeMetrics('sk_test_xxx')

    expect(result.status).toBe('healthy')
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    const result = await fetchStripeMetrics('bad-key')

    expect(result.status).toBe('unknown')
    expect(result.balance).toBeNull()
    expect(result.charges24h).toBeNull()
    expect(result.activeDisputes).toBeNull()
    expect(result.activeSubscriptions).toBeNull()
  })

  it('makes 4 API calls with correct URLs and auth header', async () => {
    mockAllApis({})

    await fetchStripeMetrics('sk_test_auth123')

    expect(global.fetch).toHaveBeenCalledTimes(4)

    // All calls should use Bearer auth
    for (let i = 0; i < 4; i++) {
      const callArgs = vi.mocked(global.fetch).mock.calls[i]
      expect(callArgs[1]?.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer sk_test_auth123' })
      )
    }

    // Verify URLs
    const urls = vi.mocked(global.fetch).mock.calls.map((c) => c[0])
    expect(urls[0]).toBe('https://api.stripe.com/v1/balance')
    expect(urls[1]).toContain('https://api.stripe.com/v1/charges')
    expect(urls[1]).toContain('created[gte]=')
    expect(urls[2]).toBe('https://api.stripe.com/v1/disputes?limit=100')
    expect(urls[3]).toBe('https://api.stripe.com/v1/subscriptions?status=active&limit=100')
  })
})

describe('stripeProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('has 4 collectors', () => {
    expect(stripeProvider.collectors).toHaveLength(4)
    const ids = stripeProvider.collectors.map((c) => c.id)
    expect(ids).toContain('account_balance')
    expect(ids).toContain('charges_24h')
    expect(ids).toContain('active_disputes')
    expect(ids).toContain('active_subscriptions')
  })

  it('has 3 alert templates', () => {
    expect(stripeProvider.alerts).toHaveLength(3)
    const ids = stripeProvider.alerts.map((a) => a.id)
    expect(ids).toContain('low-balance')
    expect(ids).toContain('active-dispute')
    expect(ids).toContain('high-charges')
  })

  it('fetchMetrics returns 4 SnapshotResults', async () => {
    mockAllApis({
      balanceCents: 1245000,
      charges: [{ amount: 500000 }, { amount: 392000 }],
      disputes: [{ status: 'needs_response', amount: 34000 }],
      subscriptions: [{ amount: 4900 }, { amount: 9900 }],
    })

    const results = await stripeProvider.fetchMetrics({ apiKey: 'sk_test_xxx' })

    expect(results).toHaveLength(4)

    const balance = results.find((r) => r.collectorId === 'account_balance')
    expect(balance?.value).toBe(12450)
    expect(balance?.unit).toBe('USD')

    const charges = results.find((r) => r.collectorId === 'charges_24h')
    expect(charges?.value).toBe(2)
    expect(charges?.unit).toBe('charges')

    const disputes = results.find((r) => r.collectorId === 'active_disputes')
    expect(disputes?.value).toBe(1)
    expect(disputes?.unit).toBe('disputes')

    const subs = results.find((r) => r.collectorId === 'active_subscriptions')
    expect(subs?.value).toBe(2)
    expect(subs?.unit).toBe('subscriptions')
  })
})
