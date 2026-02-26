import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { openrouterProvider, fetchOpenRouterMetrics } from '../openrouter'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Helper: today's UTC date string
const todayUTC = () => new Date().toISOString().slice(0, 10)

describe('OpenRouter Provider', () => {
  it('has correct metadata', () => {
    expect(openrouterProvider.id).toBe('openrouter')
    expect(openrouterProvider.category).toBe('ai')
    expect(openrouterProvider.authType).toBe('api_key')
    expect(openrouterProvider.collectors).toHaveLength(4)
  })

  it('has all four collectors defined', () => {
    const ids = openrouterProvider.collectors.map((c) => c.id)
    expect(ids).toContain('credit_balance')
    expect(ids).toContain('monthly_spend')
    expect(ids).toContain('requests_24h')
    expect(ids).toContain('models_used')
  })

  it('has correct collector metadata', () => {
    const creditBalance = openrouterProvider.collectors.find((c) => c.id === 'credit_balance')!
    expect(creditBalance.metricType).toBe('currency')
    expect(creditBalance.displayHint).toBe('currency')
    expect(creditBalance.description).toBe('Remaining OpenRouter API credits')

    const monthlySpend = openrouterProvider.collectors.find((c) => c.id === 'monthly_spend')!
    expect(monthlySpend.metricType).toBe('currency')
    expect(monthlySpend.displayHint).toBe('currency')

    const requests24h = openrouterProvider.collectors.find((c) => c.id === 'requests_24h')!
    expect(requests24h.metricType).toBe('count')
    expect(requests24h.unit).toBe('requests')

    const modelsUsed = openrouterProvider.collectors.find((c) => c.id === 'models_used')!
    expect(modelsUsed.metricType).toBe('count')
    expect(modelsUsed.unit).toBe('models')
  })

  it('has low-credits alert with threshold 2', () => {
    const alert = openrouterProvider.alerts.find((a) => a.id === 'low-credits')!
    expect(alert).toBeDefined()
    expect(alert.collectorId).toBe('credit_balance')
    expect(alert.condition).toBe('lt')
    expect(alert.defaultThreshold).toBe(2)
  })
})

describe('fetchOpenRouterMetrics', () => {
  it('returns creditBalance and monthlySpend correctly', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 31.6 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return new HttpResponse(null, { status: 403 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.creditBalance).toBe(18.4)
    expect(result.monthlySpend).toBe(31.6)
    expect(result.status).toBe('healthy')
  })

  it('returns requests24h from today activity and modelsUsed from all activity', async () => {
    const today = todayUTC()
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 10 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return HttpResponse.json({
          data: [
            { date: today, model: 'openai/gpt-4', requests: 10, usage: 1.5, prompt_tokens: 100, completion_tokens: 50, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'openai/gpt-4', endpoint_id: 'e1', provider_name: 'openai' },
            { date: today, model: 'anthropic/claude-3', requests: 5, usage: 0.8, prompt_tokens: 80, completion_tokens: 40, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'anthropic/claude-3', endpoint_id: 'e2', provider_name: 'anthropic' },
            { date: '2026-02-25', model: 'openai/gpt-4', requests: 20, usage: 3.0, prompt_tokens: 200, completion_tokens: 100, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'openai/gpt-4', endpoint_id: 'e1', provider_name: 'openai' },
            { date: '2026-02-25', model: 'meta/llama-3', requests: 8, usage: 0.3, prompt_tokens: 50, completion_tokens: 30, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'meta/llama-3', endpoint_id: 'e3', provider_name: 'meta' },
          ],
        })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    // requests_24h: only today's rows (10 + 5 = 15)
    expect(result.requests24h).toBe(15)
    // models_used: distinct models across all data (gpt-4, claude-3, llama-3)
    expect(result.modelsUsed).toBe(3)
  })

  it('sets requests24h and modelsUsed to null when activity endpoint returns 403', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 10 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return new HttpResponse(null, { status: 403 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.creditBalance).toBe(40)
    expect(result.monthlySpend).toBe(10)
    expect(result.requests24h).toBeNull()
    expect(result.modelsUsed).toBeNull()
  })

  it('counts distinct models correctly across all dates', async () => {
    const today = todayUTC()
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 100, total_usage: 5 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return HttpResponse.json({
          data: [
            { date: today, model: 'openai/gpt-4', requests: 3, usage: 0.5, prompt_tokens: 10, completion_tokens: 5, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'openai/gpt-4', endpoint_id: 'e1', provider_name: 'openai' },
            { date: '2026-02-24', model: 'openai/gpt-4', requests: 2, usage: 0.3, prompt_tokens: 10, completion_tokens: 5, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'openai/gpt-4', endpoint_id: 'e1', provider_name: 'openai' },
            { date: '2026-02-24', model: 'anthropic/claude-3', requests: 5, usage: 0.8, prompt_tokens: 20, completion_tokens: 10, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'anthropic/claude-3', endpoint_id: 'e2', provider_name: 'anthropic' },
          ],
        })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    // requests_24h: only today (3)
    expect(result.requests24h).toBe(3)
    // models_used: distinct across all dates (gpt-4, claude-3)
    expect(result.modelsUsed).toBe(2)
  })

  it('returns warning when credits below $2', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 49 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return new HttpResponse(null, { status: 403 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.creditBalance).toBe(1)
    expect(result.status).toBe('warning')
  })

  it('returns unknown on auth error', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return new HttpResponse(null, { status: 401 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.status).toBe('unknown')
    expect(result.creditBalance).toBeNull()
    expect(result.monthlySpend).toBeNull()
    expect(result.requests24h).toBeNull()
    expect(result.modelsUsed).toBeNull()
    expect(result.error).toBe('HTTP 401')
  })

  it('returns unknown on network error', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.error()
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.status).toBe('unknown')
    expect(result.error).toBe('Network error')
  })

  it('handles empty activity data', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 10 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return HttpResponse.json({ data: [] })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.requests24h).toBe(0)
    expect(result.modelsUsed).toBe(0)
  })
})

describe('fetchMetrics integration', () => {
  it('returns all four collector results', async () => {
    const today = todayUTC()
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 31.6 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/activity', () => {
        return HttpResponse.json({
          data: [
            { date: today, model: 'openai/gpt-4', requests: 1, usage: 0.5, prompt_tokens: 10, completion_tokens: 5, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'openai/gpt-4', endpoint_id: 'e1', provider_name: 'openai' },
            { date: today, model: 'anthropic/claude-3', requests: 1, usage: 0.3, prompt_tokens: 10, completion_tokens: 5, reasoning_tokens: 0, byok_usage_inference: 0, model_permaslug: 'anthropic/claude-3', endpoint_id: 'e2', provider_name: 'anthropic' },
          ],
        })
      })
    )

    const results = await openrouterProvider.fetchMetrics({ apiKey: 'test-key' })
    expect(results).toHaveLength(4)

    const credit = results.find((r) => r.collectorId === 'credit_balance')!
    expect(credit.value).toBe(18.4)
    expect(credit.unit).toBe('USD')

    const spend = results.find((r) => r.collectorId === 'monthly_spend')!
    expect(spend.value).toBe(31.6)
    expect(spend.unit).toBe('USD')

    const requests = results.find((r) => r.collectorId === 'requests_24h')!
    expect(requests.value).toBe(2)
    expect(requests.unit).toBe('requests')

    const models = results.find((r) => r.collectorId === 'models_used')!
    expect(models.value).toBe(2)
    expect(models.unit).toBe('models')
  })
})
