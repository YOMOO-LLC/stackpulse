import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: Function) => fn,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((text: string) => {
    if (text === 'encrypted-creds') return JSON.stringify({ apiKey: 'test-key' })
    if (text === 'encrypted-slack') return JSON.stringify({ webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx' })
    return text
  }),
  encrypt: vi.fn().mockReturnValue('encrypted'),
}))

vi.mock('@/lib/providers/fetch', () => ({
  fetchProviderMetrics: vi.fn().mockResolvedValue([
    { collectorId: 'credit_balance', value: 2, valueText: null, unit: 'USD', status: 'healthy' }
  ]),
}))

vi.mock('@/lib/providers', () => ({
  getProvider: vi.fn(),
}))

vi.mock('@/lib/alerts/engine', () => ({
  evaluateAlerts: vi.fn(),
}))

vi.mock('@/lib/notifications/email', () => ({
  sendAlertEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notifications/slack', () => ({
  sendSlackAlert: vi.fn().mockResolvedValue(undefined),
}))

import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/providers'
import { evaluateAlerts } from '@/lib/alerts/engine'
import { sendAlertEmail } from '@/lib/notifications/email'
import { sendSlackAlert } from '@/lib/notifications/slack'
import { POST } from '../route'

const MOCK_SERVICE = {
  id: 'svc-1',
  provider_id: 'openrouter',
  credentials: 'encrypted-creds',
  user_id: 'user-1',
  consecutive_failures: 0,
  enabled: true,
  qstash_schedule_id: 'qs-1',
}

const MOCK_PROVIDER = {
  id: 'openrouter',
  name: 'OpenRouter',
  authType: 'api_key',
  collectors: [{ id: 'credit_balance', name: 'Credit Balance', metricType: 'currency', unit: 'USD' }],
}

const TRIGGERED_RULE = {
  id: 'rule-1',
  collector_id: 'credit_balance',
  condition: 'lt',
  threshold_numeric: 5,
  threshold_text: null,
  enabled: true,
  last_notified_at: null,
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/cron/poll-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('poll-service — Slack notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProvider).mockReturnValue(MOCK_PROVIDER as never)
    vi.mocked(evaluateAlerts).mockReturnValue([TRIGGERED_RULE as never])
  })

  function setupSupabaseMock(slackChannel?: object) {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'connected_services') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: MOCK_SERVICE, error: null }),
          update: vi.fn().mockReturnThis(),
        }
      }
      if (table === 'metric_snapshots') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'alert_configs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [TRIGGERED_RULE], error: null }),
          update: vi.fn().mockReturnThis(),
        }
      }
      if (table === 'alert_events') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'notification_channels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: slackChannel ?? null,
                error: slackChannel ? null : { code: 'PGRST116' },
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    const mock = {
      from: fromMock,
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: 'user@example.com' } },
          }),
        },
      },
    }
    vi.mocked(createClient).mockReturnValue(mock as never)
    return mock
  }

  it('sends Slack alert when user has a Slack channel configured', async () => {
    setupSupabaseMock({
      id: 'ch-1',
      type: 'slack',
      config: 'encrypted-slack',
      enabled: true,
    })

    const res = await POST(makeRequest({ serviceId: 'svc-1' }) as never)
    expect(res.status).toBe(200)

    expect(sendAlertEmail).toHaveBeenCalled()
    expect(sendSlackAlert).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({
        serviceName: 'OpenRouter',
        collectorName: 'Credit Balance',
        condition: 'lt',
      })
    )
  })

  it('sends only email when no Slack channel exists', async () => {
    setupSupabaseMock(undefined)

    const res = await POST(makeRequest({ serviceId: 'svc-1' }) as never)
    expect(res.status).toBe(200)

    expect(sendAlertEmail).toHaveBeenCalled()
    expect(sendSlackAlert).not.toHaveBeenCalled()
  })
})
