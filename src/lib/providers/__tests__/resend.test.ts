import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { resendProvider, fetchResendMetrics } from '../resend'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Resend Provider', () => {
  it('has correct metadata', () => {
    expect(resendProvider.id).toBe('resend')
    expect(resendProvider.category).toBe('email')
    expect(resendProvider.authType).toBe('api_key')
  })

  it('returns healthy when API key is valid', async () => {
    server.use(
      http.get('https://api.resend.com/domains', () => {
        return HttpResponse.json({ data: [{ id: 'd1', name: 'example.com' }] })
      })
    )

    const result = await fetchResendMetrics('re_valid_key')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
  })

  it('returns critical on 401', async () => {
    server.use(
      http.get('https://api.resend.com/domains', () => {
        return new HttpResponse(null, { status: 401 })
      })
    )

    const result = await fetchResendMetrics('re_invalid_key')
    expect(result.status).toBe('critical')
  })
})
