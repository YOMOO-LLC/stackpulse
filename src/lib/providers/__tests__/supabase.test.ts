import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { supabaseProvider, fetchSupabaseMetrics } from '../supabase'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Supabase Provider', () => {
  it('has correct metadata', () => {
    expect(supabaseProvider.id).toBe('supabase')
    expect(supabaseProvider.category).toBe('infrastructure')
    expect(supabaseProvider.authType).toBe('oauth2')
    expect(supabaseProvider.collectors.length).toBeGreaterThanOrEqual(1)
  })

  it('collector has displayHint status-badge', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'connection_status')
    expect(col).toBeDefined()
    expect(col?.displayHint).toBe('status-badge')
  })

  it('returns healthy when OAuth access token is valid', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => {
        return HttpResponse.json([{ id: 'abc123', name: 'my-project' }])
      })
    )

    const result = await fetchSupabaseMetrics('valid-access-token')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
  })

  it('returns critical on 401 (expired or invalid OAuth token)', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => {
        return new HttpResponse(null, { status: 401 })
      })
    )

    const result = await fetchSupabaseMetrics('invalid-access-token')
    expect(result.status).toBe('critical')
    expect(result.value).toBe('auth_failed')
  })

  it('returns unknown on network error', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => {
        return HttpResponse.error()
      })
    )

    const result = await fetchSupabaseMetrics('any-token')
    expect(result.status).toBe('unknown')
  })

  it('fetchMetrics uses access_token from OAuth credentials', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => {
        return HttpResponse.json([])
      })
    )

    const results = await supabaseProvider.fetchMetrics({ access_token: 'oauth-token' })
    expect(results).toHaveLength(1)
    expect(results[0].collectorId).toBe('connection_status')
    expect(results[0].unit).toBe('')
  })
})
