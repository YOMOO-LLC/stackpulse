import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch before importing the module
global.fetch = vi.fn()

import { minimaxProvider, fetchMinimaxMetrics } from '../minimax'

const mockSuccess = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ data: [] }),
  }) as Response

const mockUnauth = () =>
  ({
    ok: false,
    status: 401,
    text: async () => 'Unauthorized',
  }) as Response

const mockServerError = () =>
  ({
    ok: false,
    status: 500,
    text: async () => 'Internal Server Error',
  }) as Response

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(global.fetch).mockReset()
})

describe('MiniMax Provider', () => {
  it('has correct metadata', () => {
    expect(minimaxProvider.id).toBe('minimax')
    expect(minimaxProvider.category).toBe('ai')
    expect(minimaxProvider.authType).toBe('api_key')
  })

  it('has 4 collectors', () => {
    expect(minimaxProvider.collectors).toHaveLength(4)
  })

  it('connection_status collector has displayHint status-badge', () => {
    const col = minimaxProvider.collectors.find(c => c.id === 'connection_status')
    expect(col).toBeDefined()
    expect(col?.displayHint).toBe('status-badge')
    expect(col?.description).toBe('MiniMax API connection status')
  })

  it('response_latency collector has correct thresholds', () => {
    const col = minimaxProvider.collectors.find(c => c.id === 'response_latency')
    expect(col).toBeDefined()
    expect(col?.metricType).toBe('count')
    expect(col?.unit).toBe('ms')
    expect(col?.thresholds).toEqual({ warning: 1000, critical: 3000, direction: 'above' })
    expect(col?.displayHint).toBe('number')
  })

  it('api_calls_24h collector exists', () => {
    const col = minimaxProvider.collectors.find(c => c.id === 'api_calls_24h')
    expect(col).toBeDefined()
    expect(col?.metricType).toBe('count')
    expect(col?.unit).toBe('calls')
    expect(col?.displayHint).toBe('number')
  })

  it('uptime collector exists', () => {
    const col = minimaxProvider.collectors.find(c => c.id === 'uptime')
    expect(col).toBeDefined()
    expect(col?.metricType).toBe('percentage')
    expect(col?.unit).toBe('%')
    expect(col?.displayHint).toBe('number')
  })
})

describe('fetchMinimaxMetrics', () => {
  it('returns connectionStatus connected and responseLatencyMs when API succeeds', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const result = await fetchMinimaxMetrics('valid-key')
    expect(result.connectionStatus).toBe('connected')
    expect(result.responseLatencyMs).toBeTypeOf('number')
    expect(result.status).toBe('healthy')
  })

  it('responseLatencyMs is a number >= 0', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const result = await fetchMinimaxMetrics('valid-key')
    expect(result.responseLatencyMs).toBeTypeOf('number')
    expect(result.responseLatencyMs).toBeGreaterThanOrEqual(0)
  })

  it('apiCalls24h and uptime are null', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const result = await fetchMinimaxMetrics('valid-key')
    expect(result.apiCalls24h).toBeNull()
    expect(result.uptime).toBeNull()
  })

  it('returns connectionStatus auth_failed and status unknown on 401', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockUnauth())
    const result = await fetchMinimaxMetrics('bad-key')
    expect(result.connectionStatus).toBe('auth_failed')
    expect(result.status).toBe('unknown')
    expect(result.responseLatencyMs).toBeNull()
    expect(result.error).toBe('Auth failed')
  })

  it('returns unknown on non-401 HTTP error', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockServerError())
    const result = await fetchMinimaxMetrics('key')
    expect(result.connectionStatus).toBeNull()
    expect(result.status).toBe('unknown')
    expect(result.error).toBe('HTTP 500')
  })

  it('status is warning when latency > 1000ms', async () => {
    let callCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++
      return callCount === 1 ? 1000 : 2100 // 1100ms elapsed
    })
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const result = await fetchMinimaxMetrics('key')
    expect(result.status).toBe('warning')
    expect(result.responseLatencyMs).toBe(1100)
  })

  it('status is critical when latency > 3000ms', async () => {
    let callCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++
      return callCount === 1 ? 1000 : 4500 // 3500ms elapsed
    })
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const result = await fetchMinimaxMetrics('key')
    expect(result.status).toBe('critical')
    expect(result.responseLatencyMs).toBe(3500)
  })

  it('returns unknown on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    const result = await fetchMinimaxMetrics('any-key')
    expect(result.status).toBe('unknown')
    expect(result.connectionStatus).toBeNull()
    expect(result.responseLatencyMs).toBeNull()
    expect(result.error).toBe('Network error')
  })
})

describe('minimaxProvider.fetchMetrics', () => {
  it('returns 4 SnapshotResults with correct collectorIds', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const results = await minimaxProvider.fetchMetrics({ apiKey: 'test-key' })
    expect(results).toHaveLength(4)
    expect(results[0].collectorId).toBe('connection_status')
    expect(results[1].collectorId).toBe('response_latency')
    expect(results[2].collectorId).toBe('api_calls_24h')
    expect(results[3].collectorId).toBe('uptime')
  })

  it('returns correct units for each metric', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const results = await minimaxProvider.fetchMetrics({ apiKey: 'test-key' })
    expect(results[0].unit).toBe('')
    expect(results[1].unit).toBe('ms')
    expect(results[2].unit).toBe('calls')
    expect(results[3].unit).toBe('%')
  })

  it('connection_status uses valueText, response_latency uses value', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockSuccess())
    const results = await minimaxProvider.fetchMetrics({ apiKey: 'test-key' })
    expect(results[0].valueText).toBe('connected')
    expect(results[0].value).toBeNull()
    expect(results[1].value).toBeTypeOf('number')
    expect(results[1].valueText).toBeNull()
  })
})
