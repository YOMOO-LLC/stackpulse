import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/subscription', () => ({
  getUserPlan: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { POST } from '../route'

const MOCK_USER = { id: 'user-1' }

function makePostReq(body: object) {
  return new Request('http://localhost/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  connected_service_id: 'svc-1',
  collector_id: 'credit_balance',
  condition: 'lt',
  threshold_numeric: 5,
  enabled: true,
}

describe('POST /api/alerts — alert rule count limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when alert rule count limit reached', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'free',
      limits: {
        maxServices: 3,
        pollCron: '0 * * * *',
        maxAlertRules: 3,
        maxTeamMembers: 1,
        retentionDays: 7,
        channels: ['email'],
      },
    })

    // Mock supabase: auth succeeds, count query returns 3 (at limit)
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
      from: vi.fn().mockReturnValue(countChain),
    }
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makePostReq(VALID_BODY) as never)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/limit/i)
  })

  it('allows POST when under alert rule count limit', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'free',
      limits: {
        maxServices: 3,
        pollCron: '0 * * * *',
        maxAlertRules: 3,
        maxTeamMembers: 1,
        retentionDays: 7,
        channels: ['email'],
      },
    })

    // Mock supabase: auth succeeds, count query returns 2 (under limit)
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    }
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'alert-new' }, error: null }),
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(countChain)     // 1st: count query
        .mockReturnValueOnce(insertChain),   // 2nd: insert alert_configs
    }
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makePostReq(VALID_BODY) as never)

    expect(res.status).toBe(201)
  })
})
