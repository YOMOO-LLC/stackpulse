import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { minimaxProvider, fetchMinimaxMetrics } from '../minimax'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MiniMax Provider', () => {
  it('has correct metadata', () => {
    expect(minimaxProvider.id).toBe('minimax')
    expect(minimaxProvider.category).toBe('ai')
    expect(minimaxProvider.authType).toBe('api_key')
    expect(minimaxProvider.collectors.length).toBeGreaterThanOrEqual(1)
  })

  it('collector has displayHint status-badge', () => {
    const col = minimaxProvider.collectors.find(c => c.id === 'connection_status')
    expect(col).toBeDefined()
    expect(col?.displayHint).toBe('status-badge')
  })

  it('returns healthy when API key is valid', async () => {
    server.use(
      http.get('https://api.minimax.io/v1/models', () => {
        return HttpResponse.json({ data: [{ id: 'minimax-text-01' }] })
      })
    )

    const result = await fetchMinimaxMetrics('valid-api-key')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
  })

  it('returns critical on 401 (invalid API key)', async () => {
    server.use(
      http.get('https://api.minimax.io/v1/models', () => {
        return new HttpResponse(null, { status: 401 })
      })
    )

    const result = await fetchMinimaxMetrics('invalid-api-key')
    expect(result.status).toBe('critical')
    expect(result.value).toBe('auth_failed')
  })

  it('returns unknown on network error', async () => {
    server.use(
      http.get('https://api.minimax.io/v1/models', () => {
        return HttpResponse.error()
      })
    )

    const result = await fetchMinimaxMetrics('any-key')
    expect(result.status).toBe('unknown')
  })

  it('fetchMetrics returns SnapshotResult with correct collectorId', async () => {
    server.use(
      http.get('https://api.minimax.io/v1/models', () => {
        return HttpResponse.json({ data: [] })
      })
    )

    const results = await minimaxProvider.fetchMetrics({ apiKey: 'test-key' })
    expect(results).toHaveLength(1)
    expect(results[0].collectorId).toBe('connection_status')
    expect(results[0].unit).toBe('')
  })
})
