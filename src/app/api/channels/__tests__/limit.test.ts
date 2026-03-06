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

const MOCK_USER = { id: 'user-1', email: 'dev@stackpulse.local' }

function makePostReq(body: object) {
  return new Request('http://localhost/api/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabaseAuth() {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
}

describe('POST /api/channels — channel type limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when channel type not available on plan', async () => {
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
    mockSupabaseAuth()

    const res = await POST(makePostReq({ type: 'slack' }) as never)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/slack/i)
  })

  it('returns 200 when channel type is allowed on plan', async () => {
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
    mockSupabaseAuth()

    const res = await POST(makePostReq({ type: 'email' }) as never)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('returns 403 for webhook on pro plan', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'pro',
      limits: {
        maxServices: 15,
        pollCron: '*/15 * * * *',
        maxAlertRules: 20,
        maxTeamMembers: 3,
        retentionDays: 30,
        channels: ['email', 'slack'],
      },
    })
    mockSupabaseAuth()

    const res = await POST(makePostReq({ type: 'webhook' }) as never)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/webhook/i)
  })

  it('allows slack on pro plan', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'pro',
      limits: {
        maxServices: 15,
        pollCron: '*/15 * * * *',
        maxAlertRules: 20,
        maxTeamMembers: 3,
        retentionDays: 30,
        channels: ['email', 'slack'],
      },
    })
    mockSupabaseAuth()

    const res = await POST(makePostReq({ type: 'slack' }) as never)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
