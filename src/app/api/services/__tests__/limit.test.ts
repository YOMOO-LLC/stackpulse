import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/subscription', () => ({
  getUserPlan: vi.fn(),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn().mockReturnValue('encrypted-creds'),
}))
vi.mock('@/lib/providers', () => ({
  getProvider: vi.fn().mockReturnValue({ name: 'Test', collectors: [] }),
}))
vi.mock('@/lib/providers/fetch', () => ({
  fetchProviderMetrics: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/qstash', () => ({
  registerServiceSchedule: vi.fn().mockResolvedValue('sched-1'),
}))

import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { POST } from '../route'

const MOCK_USER = { id: 'user-1' }

function makePostReq(body: object) {
  return new Request('http://localhost/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/services — service count limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
  })

  it('returns 403 when service count limit reached', async () => {
    // Mock getUserPlan returns free plan with maxServices: 3
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

    const res = await POST(makePostReq({
      providerId: 'openrouter',
      credentials: { apiKey: 'test-key' },
    }) as never)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/limit/i)
  })

  it('allows POST when under service count limit', async () => {
    // Mock getUserPlan returns free plan with maxServices: 3
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

    // Mock supabase: auth succeeds, count query returns 1 (under limit)
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
    }
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'svc-new' }, error: null }),
    }
    const snapshotChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(countChain)         // 1st: count query
        .mockReturnValueOnce(insertChain)         // 2nd: insert connected_services
        .mockReturnValueOnce(snapshotChain)       // 3rd: insert metric_snapshots
        .mockReturnValueOnce(updateChain),        // 4th: update qstash schedule
    }
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(makePostReq({
      providerId: 'openrouter',
      credentials: { apiKey: 'test-key' },
    }) as never)

    expect(res.status).toBe(201)
  })
})
