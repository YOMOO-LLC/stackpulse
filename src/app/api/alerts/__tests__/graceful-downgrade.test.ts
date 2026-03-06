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

describe('Graceful downgrade — alert rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks new alert creation when downgraded user is over the free limit', async () => {
    // User downgraded to free (max 3) but still has 5 existing alert rules
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

    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
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

  it('does not delete existing alert rules when user is over the free limit', async () => {
    // Same setup: downgraded free user with 5 alerts (over max 3)
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

    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
      from: vi.fn().mockReturnValue(countChain),
    }
    vi.mocked(createClient).mockResolvedValue(client as never)

    await POST(makePostReq(VALID_BODY) as never)

    // Verify that supabase.from() was only called once (for the count check)
    // and never called with a delete operation
    const fromCalls = client.from.mock.calls
    expect(fromCalls).toHaveLength(1)
    expect(fromCalls[0][0]).toBe('alert_configs')

    // The chain should only have select/eq (count query), never delete
    expect(countChain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(countChain).not.toHaveProperty('delete')
  })

  it('still allows creation when downgraded user is exactly at the free limit', async () => {
    // Edge case: user has exactly 2 alerts, limit is 3 — should allow one more
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
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(insertChain),
    }
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makePostReq(VALID_BODY) as never)

    expect(res.status).toBe(201)
  })
})
