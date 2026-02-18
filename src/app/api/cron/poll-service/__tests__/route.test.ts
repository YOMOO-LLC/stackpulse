import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: Function) => fn,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn().mockReturnValue(JSON.stringify({ apiKey: 'test-key' })),
}))

vi.mock('@/lib/providers/fetch', () => ({
  fetchProviderMetrics: vi.fn().mockResolvedValue([
    { collectorId: 'credit_balance', value: 10, valueText: null, unit: 'USD', status: 'healthy' }
  ]),
}))

vi.mock('@/lib/providers', () => ({
  getProvider: vi.fn(),
}))

vi.mock('@/lib/alerts/engine', () => ({
  evaluateAlerts: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/notifications/email', () => ({
  sendAlertEmail: vi.fn().mockResolvedValue(undefined),
}))

import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { POST } from '../route'

const MOCK_SERVICE = {
  id: 'svc-1',
  provider_id: 'openrouter',
  credentials: 'encrypted',
  user_id: 'user-1',
  consecutive_failures: 0,
  enabled: true,
  qstash_schedule_id: 'qs-1',
}

const MOCK_PROVIDER = {
  id: 'openrouter',
  name: 'OpenRouter',
  collectors: [{ id: 'credit_balance', name: 'Credit Balance', metricType: 'currency', unit: 'USD' }],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/cron/poll-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/cron/poll-service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 if serviceId missing', async () => {
    const res = await POST(makeRequest({}) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if service not found', async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const res = await POST(makeRequest({ serviceId: 'svc-1' }) as never)
    expect(res.status).toBe(404)
  })

  it('returns 200 on successful poll', async () => {
    vi.mocked(getProvider).mockReturnValue(MOCK_PROVIDER as never)
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_SERVICE, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const mock = {
      from: vi.fn().mockReturnValue(fromMock),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'u@example.com' } } }) } },
    }
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const res = await POST(makeRequest({ serviceId: 'svc-1' }) as never)
    expect(res.status).toBe(200)
  })
})
