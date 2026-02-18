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
    expect(openrouterProvider.collectors.length).toBeGreaterThanOrEqual(1)
  })

  it('returns healthy when balance > $5', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 25, total_usage: 5 },
        })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe(20)
  })

  it('returns warning when balance < $5', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return HttpResponse.json({
          data: { total_credits: 25, total_usage: 22 },
        })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.status).toBe('warning')
    expect(result.value).toBe(3)
  })

  it('returns unknown on 401', async () => {
    server.use(
      http.get('https://openrouter.ai/api/v1/credits', () => {
        return new HttpResponse(null, { status: 401 })
      })
    )

    const result = await fetchOpenRouterMetrics('test-api-key')
    expect(result.status).toBe('unknown')
  })
})
