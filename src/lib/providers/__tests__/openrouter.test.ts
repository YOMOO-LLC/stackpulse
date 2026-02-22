import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { openrouterProvider, fetchOpenRouterMetrics } from '../openrouter'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

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
      http.get('https://openrouter.ai/api/v1/generation', () => {
        return new HttpResponse(null, { status: 404 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.creditBalance).toBe(18.4)
    expect(result.monthlySpend).toBe(31.6)
    expect(result.status).toBe('healthy')
  })

  it('returns requests24h and modelsUsed when generation endpoint works', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 10 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/generation', () => {
        return HttpResponse.json({
          data: [
            { model: 'gpt-4' },
            { model: 'claude-3' },
            { model: 'gpt-4' },
            { model: 'llama-3' },
          ],
        })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.requests24h).toBe(4)
    expect(result.modelsUsed).toBe(3)
  })

  it('sets requests24h and modelsUsed to null when generation endpoint returns 404', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 10 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/generation', () => {
        return new HttpResponse(null, { status: 404 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.creditBalance).toBe(40)
    expect(result.monthlySpend).toBe(10)
    expect(result.requests24h).toBeNull()
    expect(result.modelsUsed).toBeNull()
  })

  it('counts distinct models correctly', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 100, total_usage: 5 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/generation', () => {
        return HttpResponse.json({
          data: [
            { model: 'gpt-4' },
            { model: 'gpt-4' },
            { model: 'gpt-4' },
            { model: 'claude-3' },
            { model: 'claude-3' },
          ],
        })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.requests24h).toBe(5)
    expect(result.modelsUsed).toBe(2)
  })

  it('returns warning when credits below $2', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 49 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/generation', () => {
        return new HttpResponse(null, { status: 404 })
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
})

describe('fetchMetrics integration', () => {
  it('returns all four collector results', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 50, total_usage: 31.6 },
        })
      }),
      http.get('https://openrouter.ai/api/v1/generation', () => {
        return HttpResponse.json({
          data: [{ model: 'gpt-4' }, { model: 'claude-3' }],
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
