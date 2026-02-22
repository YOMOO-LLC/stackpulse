import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { sentryProvider, fetchSentryMetrics } from '../sentry'
import type { SentryMetricResult } from '../sentry'

const mockFetch = fetch as ReturnType<typeof vi.fn>

function mockOrgsOk() {
  return { ok: true, json: async () => [{ slug: 'test-org' }] } as Response
}

function mockOrgsUnauthorized() {
  return { ok: false, status: 401, json: async () => ({}) } as Response
}

function mockIssues(count: number) {
  return {
    ok: true,
    headers: new Headers({ 'X-Hits': String(count) }),
    json: async () => Array(Math.min(count, 100)).fill({ id: '1', title: 'Test Error' }),
  } as Response
}

function mockIssuesNoHeader(count: number) {
  return {
    ok: true,
    headers: new Headers(),
    json: async () => Array(count).fill({ id: '1', title: 'Test Error' }),
  } as Response
}

function mockStats(total: number) {
  return {
    ok: true,
    json: async () => ({
      groups: [{ totals: { 'sum(quantity)': total }, by: { outcome: 'accepted' } }],
    }),
  } as Response
}

function mockSessions(total: number, crashed: number) {
  return {
    ok: true,
    json: async () => ({
      groups: [
        { by: { 'session.status': 'healthy' }, totals: { 'count()': total - crashed } },
        { by: { 'session.status': 'crashed' }, totals: { 'count()': crashed } },
      ],
    }),
  } as Response
}

function mockSessionsFail() {
  return { ok: false, status: 500, json: async () => ({}) } as Response
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('Sentry Provider', () => {
  it('has correct metadata', () => {
    expect(sentryProvider.id).toBe('sentry')
    expect(sentryProvider.category).toBe('monitoring')
    expect(sentryProvider.authType).toBe('oauth2')
  })

  it('has 4 collectors', () => {
    expect(sentryProvider.collectors).toHaveLength(4)
    const ids = sentryProvider.collectors.map((c) => c.id)
    expect(ids).toEqual(['unresolved_errors', 'crash_free_rate', 'events_24h', 'p95_latency'])
  })

  it('has correct alert templates', () => {
    expect(sentryProvider.alerts).toHaveLength(2)
    expect(sentryProvider.alerts[0].id).toBe('high-unresolved')
    expect(sentryProvider.alerts[0].collectorId).toBe('unresolved_errors')
    expect(sentryProvider.alerts[0].condition).toBe('gt')
    expect(sentryProvider.alerts[1].id).toBe('low-crash-free')
    expect(sentryProvider.alerts[1].collectorId).toBe('crash_free_rate')
    expect(sentryProvider.alerts[1].condition).toBe('lt')
  })
})

describe('fetchSentryMetrics', () => {
  it('returns all 4 metrics correctly', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())          // auth check
      .mockResolvedValueOnce(mockIssues(8))          // issues (<=10, healthy)
      .mockResolvedValueOnce(mockStats(8412))        // stats_v2
      .mockResolvedValueOnce(mockSessions(1000, 5))  // sessions (99.5% crash-free, healthy)

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(8)
    expect(result.events24h).toBe(8412)
    expect(result.crashFreeRate).toBeCloseTo(99.5, 1)
    expect(result.p95Latency).toBeNull()
    expect(result.status).toBe('healthy')
  })

  it('calculates crash-free rate correctly (100 total, 1 crashed = 99%)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(100))
      .mockResolvedValueOnce(mockSessions(100, 1))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.crashFreeRate).toBe(99)
    expect(result.status).toBe('healthy')
  })

  it('returns unknown on auth error', async () => {
    mockFetch.mockResolvedValueOnce(mockOrgsUnauthorized())

    const result = await fetchSentryMetrics('bad-token', 'test-org')

    expect(result.status).toBe('unknown')
    expect(result.error).toMatch(/401/)
    expect(result.unresolvedErrors).toBeNull()
    expect(result.crashFreeRate).toBeNull()
    expect(result.events24h).toBeNull()
    expect(result.p95Latency).toBeNull()
  })

  it('status is warning when unresolvedErrors > 10', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(25))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockSessions(1000, 5))  // 99.5% crash-free (healthy)

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(25)
    expect(result.status).toBe('warning')
  })

  it('status is critical when crashFreeRate < 97', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockSessions(100, 5))  // 95% crash-free

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.crashFreeRate).toBe(95)
    expect(result.status).toBe('critical')
  })

  it('status is warning when crashFreeRate < 99 but >= 97', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockSessions(100, 2))  // 98% crash-free

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.crashFreeRate).toBe(98)
    expect(result.status).toBe('warning')
  })

  it('handles missing sessions gracefully (null crash-free rate)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockSessionsFail())

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.crashFreeRate).toBeNull()
    expect(result.events24h).toBe(500)
    expect(result.unresolvedErrors).toBe(5)
  })

  it('uses X-Hits header for issue count when available', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(250))  // X-Hits: 250, but only 100 in array
      .mockResolvedValueOnce(mockStats(100))
      .mockResolvedValueOnce(mockSessions(1000, 5))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(250)
  })

  it('falls back to array length when X-Hits header is missing', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssuesNoHeader(7))
      .mockResolvedValueOnce(mockStats(100))
      .mockResolvedValueOnce(mockSessions(1000, 5))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(7)
  })

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.status).toBe('unknown')
    expect(result.error).toBe('Network error')
  })
})

describe('sentryProvider.fetchMetrics', () => {
  it('returns 4 snapshot results matching collectors', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(8))
      .mockResolvedValueOnce(mockStats(8412))
      .mockResolvedValueOnce(mockSessions(1000, 5))

    const results = await sentryProvider.fetchMetrics({ access_token: 'token', orgSlug: 'test-org' })

    expect(results).toHaveLength(4)
    expect(results[0]).toEqual({ collectorId: 'unresolved_errors', value: 8, valueText: null, unit: 'issues', status: 'healthy' })
    expect(results[1]).toEqual({ collectorId: 'crash_free_rate', value: expect.closeTo(99.5, 1), valueText: null, unit: '%', status: 'healthy' })
    expect(results[2]).toEqual({ collectorId: 'events_24h', value: 8412, valueText: null, unit: 'events', status: 'healthy' })
    expect(results[3]).toEqual({ collectorId: 'p95_latency', value: null, valueText: null, unit: 'ms', status: 'healthy' })
  })
})
