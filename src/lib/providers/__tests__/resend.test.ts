import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchResendMetrics, resendProvider } from '../resend'

const mockFetch = vi.mocked(global.fetch)

const mockDomains = (domains: Array<{ status: string }>) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      data: domains.map((d, i) => ({
        id: `dom-${i}`,
        name: `domain${i}.com`,
        status: d.status,
      })),
    }),
  }) as unknown as Response

const mockEmails = (
  emails: Array<{ created_at: string; last_event: string }>
) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ data: emails }),
  }) as unknown as Response

const mockUnauth = () =>
  ({
    ok: false,
    status: 401,
    text: async () => 'Unauthorized',
  }) as unknown as Response

const mockError = () =>
  ({
    ok: false,
    status: 500,
    text: async () => 'Internal Server Error',
  }) as unknown as Response

function recentDate(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('Resend Provider', () => {
  it('has correct metadata', () => {
    expect(resendProvider.id).toBe('resend')
    expect(resendProvider.category).toBe('email')
    expect(resendProvider.authType).toBe('api_key')
  })

  it('has 4 collectors: emails_sent_24h, bounce_rate, domain_health, monthly_quota', () => {
    const ids = resendProvider.collectors.map((c) => c.id)
    expect(ids).toEqual([
      'emails_sent_24h',
      'bounce_rate',
      'domain_health',
      'monthly_quota',
    ])
  })

  it('has correct collector metadata for emails_sent_24h', () => {
    const col = resendProvider.collectors.find(
      (c) => c.id === 'emails_sent_24h'
    )
    expect(col).toBeDefined()
    expect(col!.metricType).toBe('count')
    expect(col!.unit).toBe('emails')
    expect(col!.trend).toBe(true)
  })

  it('has correct collector metadata for bounce_rate', () => {
    const col = resendProvider.collectors.find((c) => c.id === 'bounce_rate')
    expect(col).toBeDefined()
    expect(col!.metricType).toBe('percentage')
    expect(col!.unit).toBe('%')
    expect(col!.displayHint).toBe('number')
    expect(col!.thresholds).toEqual({
      warning: 2,
      critical: 5,
      direction: 'above',
    })
  })

  it('has correct collector metadata for domain_health', () => {
    const col = resendProvider.collectors.find((c) => c.id === 'domain_health')
    expect(col).toBeDefined()
    expect(col!.metricType).toBe('count')
    expect(col!.displayHint).toBe('number')
  })

  it('has correct collector metadata for monthly_quota', () => {
    const col = resendProvider.collectors.find((c) => c.id === 'monthly_quota')
    expect(col).toBeDefined()
    expect(col!.metricType).toBe('count')
    expect(col!.unit).toBe('emails')
  })

  it('has alert templates for high bounce rate and domain unverified', () => {
    const alertIds = resendProvider.alerts.map((a) => a.id)
    expect(alertIds).toContain('high-bounce-rate')
    expect(alertIds).toContain('domain-unverified')

    const bounceAlert = resendProvider.alerts.find(
      (a) => a.id === 'high-bounce-rate'
    )
    expect(bounceAlert!.collectorId).toBe('bounce_rate')
    expect(bounceAlert!.condition).toBe('gt')
    expect(bounceAlert!.defaultThreshold).toBe(2)

    const domainAlert = resendProvider.alerts.find(
      (a) => a.id === 'domain-unverified'
    )
    expect(domainAlert!.collectorId).toBe('domain_health')
    expect(domainAlert!.condition).toBe('lt')
    expect(domainAlert!.defaultThreshold).toBe(1)
  })
})

describe('fetchResendMetrics', () => {
  it('returns all metrics when both endpoints succeed', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockDomains([{ status: 'verified' }, { status: 'verified' }])
      )
      .mockResolvedValueOnce(
        mockEmails([
          { created_at: recentDate(1), last_event: 'delivered' },
          { created_at: recentDate(2), last_event: 'delivered' },
          { created_at: recentDate(3), last_event: 'delivered' },
        ])
      )

    const result = await fetchResendMetrics('re_test_key')

    expect(result.emailsSent24h).toBe(3)
    expect(result.verifiedDomains).toBe(2)
    expect(result.totalDomains).toBe(2)
    expect(result.bounceRate).toBe(0)
    expect(result.bounceCount).toBe(0)
    expect(result.deliveryRate).toBe(100)
    expect(result.status).toBe('healthy')
    expect(result.error).toBeUndefined()
  })

  it('counts verified domains correctly', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockDomains([
          { status: 'verified' },
          { status: 'not_started' },
          { status: 'verified' },
          { status: 'pending' },
        ])
      )
      .mockResolvedValueOnce(mockEmails([]))

    const result = await fetchResendMetrics('re_test_key')

    expect(result.verifiedDomains).toBe(2)
    expect(result.totalDomains).toBe(4)
    expect(result.status).toBe('warning') // unverified domains -> warning
  })

  it('calculates bounce rate correctly (5 sent, 1 bounced = 20%)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockDomains([{ status: 'verified' }]))
      .mockResolvedValueOnce(
        mockEmails([
          { created_at: recentDate(1), last_event: 'delivered' },
          { created_at: recentDate(2), last_event: 'delivered' },
          { created_at: recentDate(3), last_event: 'bounced' },
          { created_at: recentDate(4), last_event: 'delivered' },
          { created_at: recentDate(5), last_event: 'delivered' },
        ])
      )

    const result = await fetchResendMetrics('re_test_key')

    expect(result.emailsSent24h).toBe(5)
    expect(result.bounceCount).toBe(1)
    expect(result.bounceRate).toBe(20)
    expect(result.deliveryRate).toBe(80)
  })

  it('returns unknown status on 401', async () => {
    mockFetch
      .mockResolvedValueOnce(mockUnauth())
      .mockResolvedValueOnce(mockUnauth())

    const result = await fetchResendMetrics('re_bad_key')

    expect(result.status).toBe('unknown')
    expect(result.error).toBe('Auth failed')
    expect(result.emailsSent24h).toBeNull()
    expect(result.verifiedDomains).toBeNull()
  })

  it('emailsSent24h only counts emails in last 24h', async () => {
    mockFetch
      .mockResolvedValueOnce(mockDomains([{ status: 'verified' }]))
      .mockResolvedValueOnce(
        mockEmails([
          { created_at: recentDate(1), last_event: 'delivered' },
          { created_at: recentDate(12), last_event: 'delivered' },
          { created_at: recentDate(25), last_event: 'delivered' }, // > 24h ago
          { created_at: recentDate(48), last_event: 'delivered' }, // > 24h ago
        ])
      )

    const result = await fetchResendMetrics('re_test_key')

    expect(result.emailsSent24h).toBe(2)
    expect(result.monthlyQuota).toBe(4) // total emails in response
  })

  it('status is critical when bounce rate >= 5%', async () => {
    // 10 emails, 1 bounced = 10% > 5%
    const emails = Array.from({ length: 10 }, (_, i) => ({
      created_at: recentDate(i + 1),
      last_event: i === 0 ? 'bounced' : 'delivered',
    }))
    // Actually make 2 bounced out of 10 = 20% to be well above threshold
    emails[1] = { created_at: recentDate(2), last_event: 'bounced' }

    mockFetch
      .mockResolvedValueOnce(mockDomains([{ status: 'verified' }]))
      .mockResolvedValueOnce(mockEmails(emails))

    const result = await fetchResendMetrics('re_test_key')

    expect(result.bounceRate).toBeGreaterThanOrEqual(5)
    expect(result.status).toBe('critical')
  })

  it('status is warning when bounce rate >= 2% but < 5%', async () => {
    // 50 emails, 1 bounced = 2%
    const emails = Array.from({ length: 50 }, (_, i) => ({
      created_at: recentDate(i * 0.4 + 0.1), // all within 24h
      last_event: i === 0 ? 'bounced' : 'delivered',
    }))

    mockFetch
      .mockResolvedValueOnce(mockDomains([{ status: 'verified' }]))
      .mockResolvedValueOnce(mockEmails(emails))

    const result = await fetchResendMetrics('re_test_key')

    expect(result.bounceRate).toBe(2)
    expect(result.status).toBe('warning')
  })

  it('returns unknown on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchResendMetrics('re_test_key')

    expect(result.status).toBe('unknown')
    expect(result.error).toBe('Network error')
    expect(result.emailsSent24h).toBeNull()
  })

  it('handles email endpoint failure gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(mockDomains([{ status: 'verified' }]))
      .mockResolvedValueOnce(mockError())

    const result = await fetchResendMetrics('re_test_key')

    expect(result.verifiedDomains).toBe(1)
    expect(result.emailsSent24h).toBeNull()
    expect(result.bounceRate).toBeNull()
  })
})

describe('resendProvider.fetchMetrics', () => {
  it('returns 4 snapshot results with correct collectorIds', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockDomains([{ status: 'verified' }, { status: 'verified' }])
      )
      .mockResolvedValueOnce(
        mockEmails([
          { created_at: recentDate(1), last_event: 'delivered' },
          { created_at: recentDate(2), last_event: 'delivered' },
        ])
      )

    const results = await resendProvider.fetchMetrics({ apiKey: 're_test' })

    expect(results).toHaveLength(4)
    expect(results.map((r) => r.collectorId)).toEqual([
      'emails_sent_24h',
      'bounce_rate',
      'domain_health',
      'monthly_quota',
    ])

    const emailsSent = results.find((r) => r.collectorId === 'emails_sent_24h')
    expect(emailsSent!.value).toBe(2)
    expect(emailsSent!.unit).toBe('emails')

    const bounceRate = results.find((r) => r.collectorId === 'bounce_rate')
    expect(bounceRate!.value).toBe(0)
    expect(bounceRate!.unit).toBe('%')

    const domainHealth = results.find((r) => r.collectorId === 'domain_health')
    expect(domainHealth!.value).toBe(2)
    expect(domainHealth!.unit).toBe('domains')

    const monthlyQuota = results.find((r) => r.collectorId === 'monthly_quota')
    expect(monthlyQuota!.value).toBe(2)
    expect(monthlyQuota!.unit).toBe('emails')
  })
})
