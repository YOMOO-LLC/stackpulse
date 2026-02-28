import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchOpenAIMetrics } from '../openai'

const mockGrants = (balance: number) => ({
  ok: true,
  json: async () => ({ grants: { data: [{ grant_amount: balance + 10, used_amount: 10 }] } }),
} as Response)

const mockUsage = (totalCents: number) => ({
  ok: true,
  json: async () => ({ total_usage: totalCents }),
} as Response)

const mockOrgUsage = (models: Array<{ model_id: string; num_model_requests: number }>) => ({
  ok: true,
  json: async () => ({
    data: [{ results: models.map(m => ({ model_id: m.model_id, num_model_requests: m.num_model_requests, input_tokens: 100, output_tokens: 50 })) }],
  }),
} as Response)

const mockOrgUsageError = () => ({ ok: false, status: 403, text: async () => 'Forbidden' } as Response)

describe('fetchOpenAIMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns credit balance and monthly usage', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(80))
      .mockResolvedValueOnce(mockUsage(3500))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.creditBalance).toBeCloseTo(80)
    expect(result.monthlyUsage).toBeCloseTo(35)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when credit balance < $5', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(4))
      .mockResolvedValueOnce(mockUsage(100))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.status).toBe('warning')
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await fetchOpenAIMetrics('bad-key')
    expect(result.status).toBe('unknown')
  })

  it('returns apiRequests when org endpoint works', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsage([
        { model_id: 'gpt-4o', num_model_requests: 1200 },
        { model_id: 'gpt-4o-mini', num_model_requests: 2040 },
      ]))
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.apiRequests).toBe(3240)
  })

  it('sets apiRequests to null when org endpoint returns 403', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.apiRequests).toBeNull()
  })

  it('returns modelUsage array with correct model data', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsage([
        { model_id: 'gpt-4o', num_model_requests: 1200 },
        { model_id: 'dall-e-3', num_model_requests: 40 },
      ]))
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.modelUsage).not.toBeNull()
    expect(result.modelUsage).toHaveLength(2)
    expect(result.modelUsage![0].model).toBe('gpt-4o')
    expect(result.modelUsage![0].requests).toBe(1200)
    expect(result.modelUsage![1].model).toBe('dall-e-3')
    expect(result.modelUsage![1].requests).toBe(40)
  })

  it('sets modelUsage to null when org endpoint fails', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.modelUsage).toBeNull()
  })

  it('returns healthy with null billing when billing returns 403 but /v1/models confirms key is valid', async () => {
    const mock403 = { ok: false, status: 403 } as Response
    const mockModels = { ok: true, json: async () => ({ data: [] }) } as Response
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mock403)          // credit_grants → 403
      .mockResolvedValueOnce(mock403)          // usage → 403
      .mockResolvedValueOnce(mockModels)       // /v1/models → 200 (fallback auth check)
    const result = await fetchOpenAIMetrics('sk-proj-xxx')
    expect(result.status).toBe('healthy')
    expect(result.creditBalance).toBeNull()
    expect(result.monthlyUsage).toBeNull()
    expect(result.apiRequests).toBeNull()
  })

  it('returns warning when monthly usage > $50', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(80))
      .mockResolvedValueOnce(mockUsage(5100))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.status).toBe('warning')
  })
})

// ── Admin key helpers ─────────────────────────────────────────────────────────

const mockOrgCosts = (dailyAmounts: number[]) => ({
  ok: true,
  json: async () => ({
    object: 'page',
    data: dailyAmounts.map((amt) => ({
      object: 'bucket',
      results: amt > 0 ? [{ amount: { value: String(amt), currency: 'usd' } }] : [],
    })),
    has_more: false,
  }),
} as Response)

const mockOrgCompletions = (models: Array<{ model_id: string; num_model_requests: number }>) => ({
  ok: true,
  json: async () => ({
    object: 'page',
    data: [{ results: models.map(m => ({ model_id: m.model_id, num_model_requests: m.num_model_requests, input_tokens: 100, output_tokens: 50 })) }],
    has_more: false,
  }),
} as Response)

const mockOrgCompletionsMultiBucket = (
  buckets: Array<Array<{ model_id: string; num_model_requests: number }>>,
) => ({
  ok: true,
  json: async () => ({
    object: 'page',
    data: buckets.map(models => ({
      results: models.map(m => ({ model_id: m.model_id, num_model_requests: m.num_model_requests, input_tokens: 100, output_tokens: 50 })),
    })),
    has_more: false,
  }),
} as Response)

const mockOrgCompletionsEmpty = () => ({
  ok: true,
  json: async () => ({ object: 'page', data: [{ results: [] }], has_more: false }),
} as Response)

describe('fetchOpenAIMetrics (admin key)', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns monthly usage from /v1/organization/costs', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOrgCosts([0.50, 1.20, 0.30]))   // costs
      .mockResolvedValueOnce(mockOrgCompletionsEmpty())            // completions
    const result = await fetchOpenAIMetrics('sk-admin-xxx')
    expect(result.monthlyUsage).toBeCloseTo(2.00)
    expect(result.status).toBe('healthy')
  })

  it('returns apiRequests from /v1/organization/usage/completions', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOrgCosts([0.10]))
      .mockResolvedValueOnce(mockOrgCompletions([
        { model_id: 'gpt-4o', num_model_requests: 500 },
        { model_id: 'gpt-4o-mini', num_model_requests: 1200 },
      ]))
    const result = await fetchOpenAIMetrics('sk-admin-xxx')
    expect(result.apiRequests).toBe(1700)
    expect(result.modelUsage).toHaveLength(2)
    expect(result.modelUsage![0].model).toBe('gpt-4o')
  })

  it('sets creditBalance to null (not available via admin key)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOrgCosts([1.00]))
      .mockResolvedValueOnce(mockOrgCompletionsEmpty())
    const result = await fetchOpenAIMetrics('sk-admin-xxx')
    expect(result.creditBalance).toBeNull()
  })

  it('returns unknown when costs endpoint fails (invalid admin key)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await fetchOpenAIMetrics('sk-admin-bad')
    expect(result.status).toBe('unknown')
  })

  it('returns warning when monthly usage > $50', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOrgCosts([30, 25]))
      .mockResolvedValueOnce(mockOrgCompletionsEmpty())
    const result = await fetchOpenAIMetrics('sk-admin-xxx')
    expect(result.monthlyUsage).toBeCloseTo(55)
    expect(result.status).toBe('warning')
  })

  it('returns healthy with zero usage when no cost data', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOrgCosts([0, 0, 0]))
      .mockResolvedValueOnce(mockOrgCompletionsEmpty())
    const result = await fetchOpenAIMetrics('sk-admin-xxx')
    expect(result.monthlyUsage).toBe(0)
    expect(result.status).toBe('healthy')
  })

  it('aggregates same model across multiple daily buckets', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOrgCosts([0.10]))
      .mockResolvedValueOnce(mockOrgCompletionsMultiBucket([
        [{ model_id: 'gpt-4o', num_model_requests: 2 }, { model_id: 'gpt-4o-mini', num_model_requests: 5 }],
        [{ model_id: 'gpt-4o', num_model_requests: 3 }],
        [{ model_id: 'gpt-4o-mini', num_model_requests: 1 }],
      ]))
    const result = await fetchOpenAIMetrics('sk-admin-xxx')
    expect(result.apiRequests).toBe(11)
    expect(result.modelUsage).toHaveLength(2)
    const gpt4o = result.modelUsage!.find(m => m.model === 'gpt-4o')!
    const mini = result.modelUsage!.find(m => m.model === 'gpt-4o-mini')!
    expect(gpt4o.requests).toBe(5)
    expect(mini.requests).toBe(6)
  })
})
