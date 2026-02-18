import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { sentryProvider, fetchSentryMetrics } from '../sentry'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Sentry Provider', () => {
  it('has correct metadata', () => {
    expect(sentryProvider.id).toBe('sentry')
    expect(sentryProvider.category).toBe('monitoring')
    expect(sentryProvider.authType).toBe('api_key')
  })

  it('returns error count with healthy status', async () => {
    server.use(
      http.get('https://sentry.io/api/0/organizations/', () => {
        return HttpResponse.json([{ slug: 'my-org' }])
      }),
      http.get('https://sentry.io/api/0/organizations/my-org/stats_v2/', () => {
        return HttpResponse.json({
          groups: [{ totals: { 'sum(quantity)': 1234 } }],
        })
      })
    )

    const result = await fetchSentryMetrics('sentry-token', 'my-org')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe(1234)
  })

  it('returns unknown on 401', async () => {
    server.use(
      http.get('https://sentry.io/api/0/organizations/', () => {
        return new HttpResponse(null, { status: 401 })
      })
    )

    const result = await fetchSentryMetrics('bad-token', 'my-org')
    expect(result.status).toBe('unknown')
  })
})
