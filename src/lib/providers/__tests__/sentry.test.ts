import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { sentryProvider, fetchSentryMetrics, fetchSentryOrganizations } from '../sentry'
import type { SentryMetricResult } from '../sentry'

const mockFetch = fetch as ReturnType<typeof vi.fn>

function mockOrgsOk() {
  return { ok: true, json: async () => [{ slug: 'test-org' }] } as Response
}

function mockOrgsMultiple() {
  return {
    ok: true,
    json: async () => [
      { slug: 'my-team', name: 'My Team' },
      { slug: 'side-project', name: 'Side Project' },
      { slug: 'acme-corp', name: 'Acme Corp' },
    ],
  } as Response
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

function mockEvents(p95: number, apdex: number) {
  return {
    ok: true,
    json: async () => ({
      data: [{ 'p95(transaction.duration)': p95, 'apdex()': apdex }],
    }),
  } as Response
}

function mockEventsFail() {
  return { ok: false, status: 500, json: async () => ({}) } as Response
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('Sentry Provider', () => {
  it('has correct metadata', () => {
    expect(sentryProvider.id).toBe('sentry')
    expect(sentryProvider.category).toBe('monitoring')
    expect(sentryProvider.authType).toBe('api_key')
  })

  it('has api_key credentials with authToken field', () => {
    expect(sentryProvider.credentials).toHaveLength(1)
    expect(sentryProvider.credentials[0].key).toBe('authToken')
    expect(sentryProvider.credentials[0].type).toBe('password')
  })

  it('has keyGuide with sentry settings URL', () => {
    expect(sentryProvider.keyGuide).toBeDefined()
    expect(sentryProvider.keyGuide!.url).toContain('sentry.io')
    expect(sentryProvider.keyGuide!.steps.length).toBeGreaterThan(0)
  })

  it('has projectSelector for org selection', () => {
    expect(sentryProvider.projectSelector).toBeDefined()
    expect(sentryProvider.projectSelector!.key).toBe('orgSlug')
    expect(sentryProvider.projectSelector!.label).toBe('Select Organization')
  })

  it('has 4 collectors', () => {
    expect(sentryProvider.collectors).toHaveLength(4)
    const ids = sentryProvider.collectors.map((c) => c.id)
    expect(ids).toEqual(['unresolved_errors', 'apdex', 'events_24h', 'p95_latency'])
  })

  it('has correct alert templates', () => {
    expect(sentryProvider.alerts).toHaveLength(2)
    expect(sentryProvider.alerts[0].id).toBe('high-unresolved')
    expect(sentryProvider.alerts[0].collectorId).toBe('unresolved_errors')
    expect(sentryProvider.alerts[0].condition).toBe('gt')
    expect(sentryProvider.alerts[1].id).toBe('low-apdex')
    expect(sentryProvider.alerts[1].collectorId).toBe('apdex')
    expect(sentryProvider.alerts[1].condition).toBe('lt')
  })
})

describe('fetchSentryOrganizations', () => {
  it('returns org list with value=slug and label=name', async () => {
    mockFetch.mockResolvedValueOnce(mockOrgsMultiple())

    const options = await fetchSentryOrganizations('my-token')

    expect(options).toHaveLength(3)
    expect(options[0]).toEqual({ value: 'my-team', label: 'My Team' })
    expect(options[1]).toEqual({ value: 'side-project', label: 'Side Project' })
    expect(options[2]).toEqual({ value: 'acme-corp', label: 'Acme Corp' })
  })

  it('returns empty array on auth failure', async () => {
    mockFetch.mockResolvedValueOnce(mockOrgsUnauthorized())

    const options = await fetchSentryOrganizations('bad-token')

    expect(options).toEqual([])
  })

  it('uses slug as label fallback when name is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ slug: 'no-name-org' }],
    } as Response)

    const options = await fetchSentryOrganizations('token')

    expect(options[0]).toEqual({ value: 'no-name-org', label: 'no-name-org' })
  })
})

describe('fetchSentryMetrics', () => {
  it('returns all 4 metrics correctly', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())            // auth check
      .mockResolvedValueOnce(mockIssues(8))            // issues (<=10, healthy)
      .mockResolvedValueOnce(mockStats(8412))          // stats_v2
      .mockResolvedValueOnce(mockEvents(3500, 0.85))   // events (p95 + apdex)

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(8)
    expect(result.events24h).toBe(8412)
    expect(result.apdex).toBeCloseTo(0.85, 2)
    expect(result.p95Latency).toBeCloseTo(3500, 0)
    expect(result.status).toBe('healthy')
  })

  it('returns unknown on auth error', async () => {
    mockFetch.mockResolvedValueOnce(mockOrgsUnauthorized())

    const result = await fetchSentryMetrics('bad-token', 'test-org')

    expect(result.status).toBe('unknown')
    expect(result.error).toMatch(/401/)
    expect(result.unresolvedErrors).toBeNull()
    expect(result.apdex).toBeNull()
    expect(result.events24h).toBeNull()
    expect(result.p95Latency).toBeNull()
  })

  it('status is warning when unresolvedErrors > 10', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(25))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockEvents(500, 0.9))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(25)
    expect(result.status).toBe('warning')
  })

  it('status is critical when apdex < 0.5', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockEvents(5000, 0.3))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.apdex).toBeCloseTo(0.3, 2)
    expect(result.status).toBe('critical')
  })

  it('status is warning when apdex < 0.75 but >= 0.5', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockEvents(2000, 0.6))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.apdex).toBeCloseTo(0.6, 2)
    expect(result.status).toBe('warning')
  })

  it('handles missing events gracefully (null apdex and p95)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(5))
      .mockResolvedValueOnce(mockStats(500))
      .mockResolvedValueOnce(mockEventsFail())

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.apdex).toBeNull()
    expect(result.p95Latency).toBeNull()
    expect(result.events24h).toBe(500)
    expect(result.unresolvedErrors).toBe(5)
  })

  it('uses X-Hits header for issue count when available', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssues(250))  // X-Hits: 250, but only 100 in array
      .mockResolvedValueOnce(mockStats(100))
      .mockResolvedValueOnce(mockEvents(1000, 0.8))

    const result = await fetchSentryMetrics('token', 'test-org')

    expect(result.unresolvedErrors).toBe(250)
  })

  it('falls back to array length when X-Hits header is missing', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOrgsOk())
      .mockResolvedValueOnce(mockIssuesNoHeader(7))
      .mockResolvedValueOnce(mockStats(100))
      .mockResolvedValueOnce(mockEvents(1000, 0.8))

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
      .mockResolvedValueOnce(mockEvents(3500, 0.85))

    const results = await sentryProvider.fetchMetrics({ authToken: 'token', orgSlug: 'test-org' })

    expect(results).toHaveLength(4)
    expect(results[0]).toEqual({ collectorId: 'unresolved_errors', value: 8, valueText: null, unit: 'issues', status: 'healthy' })
    expect(results[1]).toEqual({ collectorId: 'apdex', value: expect.closeTo(0.85, 2), valueText: '0.850', unit: '', status: 'healthy' })
    expect(results[2]).toEqual({ collectorId: 'events_24h', value: 8412, valueText: null, unit: 'events', status: 'healthy' })
    expect(results[3]).toEqual({ collectorId: 'p95_latency', value: expect.closeTo(3500, 0), valueText: null, unit: 'ms', status: 'healthy' })
  })
})
