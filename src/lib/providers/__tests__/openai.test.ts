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

  it('returns apiRequests24h when org endpoint works', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsage([
        { model_id: 'gpt-4o', num_model_requests: 1200 },
        { model_id: 'gpt-4o-mini', num_model_requests: 2040 },
      ]))
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.apiRequests24h).toBe(3240)
  })

  it('sets apiRequests24h to null when org endpoint returns 403', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.apiRequests24h).toBeNull()
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

  it('sets avgLatency to null always', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockGrants(50))
      .mockResolvedValueOnce(mockUsage(800))
      .mockResolvedValueOnce(mockOrgUsageError())
    const result = await fetchOpenAIMetrics('sk-xxx')
    expect(result.avgLatency).toBeNull()
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
