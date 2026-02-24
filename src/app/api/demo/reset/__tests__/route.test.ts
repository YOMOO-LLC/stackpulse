import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock demo sequences
vi.mock('@/lib/providers/demo-sequences', () => ({
  ALL_DEMO_SEQUENCES: [
    {
      providerId: 'github',
      snapshots: [
        { collectorId: 'rate_limit_remaining', value: 1240, valueText: null, unit: 'requests', status: 'warning', hoursAgo: 0 },
        { collectorId: 'rate_limit_remaining', value: 4980, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 48 },
      ],
    },
  ],
}))

import { createClient } from '@/lib/supabase/server'
const mockCreateClient = vi.mocked(createClient)

/**
 * Creates a mock Supabase client with chainable query builder methods.
 * Allows per-table overrides for specific test scenarios.
 */
function makeMockSupabase(overrides: {
  getUser?: { data: { user: { email: string } | null } }
  servicesList?: { data: { id: string; provider_id: string }[] | null; error: null | { message: string } }
  deleteResult?: { error: null | { message: string } }
  insertResult?: { error: null | { message: string } }
  alertConfigs?: { data: { id: string }[] | null; error: null | { message: string } }
} = {}) {
  const defaultChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue(overrides.insertResult ?? { error: null }),
    update: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: unknown) => void) => resolve(overrides.deleteResult ?? { error: null })),
  }

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'connected_services') {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve(overrides.servicesList ?? { data: [{ id: 'svc-1', provider_id: 'github' }], error: null }),
        }),
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
      return chain
    }
    if (table === 'alert_configs') {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve(overrides.alertConfigs ?? { data: [], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }
    if (table === 'metric_snapshots') {
      return {
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue(overrides.deleteResult ?? { error: null }),
        }),
        insert: vi.fn().mockResolvedValue(overrides.insertResult ?? { error: null }),
      }
    }
    if (table === 'alert_events') {
      return {
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }
    return defaultChain
  })

  return {
    from: fromMock,
    auth: {
      getUser: vi.fn().mockResolvedValue(
        overrides.getUser ?? { data: { user: null } }
      ),
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [{ id: 'demo-user-id', email: 'demo@stackpulse.io' }] },
        }),
      },
    },
  }
}

describe('POST /api/demo/reset', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...OLD_ENV,
      DEMO_RESET_SECRET: 'test-secret-abc',
      NEXT_PUBLIC_DEMO_EMAIL: 'demo@stackpulse.io',
    }
  })

  afterAll(() => { process.env = OLD_ENV })

  it('returns 401 when no Authorization header and no session', async () => {
    const supabase = makeMockSupabase()
    mockCreateClient.mockResolvedValue(supabase as any)

    const req = new NextRequest('http://localhost/api/demo/reset', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when Bearer token is wrong', async () => {
    const supabase = makeMockSupabase()
    mockCreateClient.mockResolvedValue(supabase as any)

    const req = new NextRequest('http://localhost/api/demo/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct Bearer token', async () => {
    const supabase = makeMockSupabase({
      servicesList: { data: [{ id: 'svc-1', provider_id: 'github' }], error: null },
    })
    mockCreateClient.mockResolvedValue(supabase as any)

    const req = new NextRequest('http://localhost/api/demo/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-abc' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body).toHaveProperty('reset_at')
  })

  it('returns 200 when authenticated as demo user session', async () => {
    const supabase = makeMockSupabase({
      getUser: { data: { user: { email: 'demo@stackpulse.io' } } },
      servicesList: { data: [{ id: 'svc-1', provider_id: 'github' }], error: null },
    })
    mockCreateClient.mockResolvedValue(supabase as any)

    const req = new NextRequest('http://localhost/api/demo/reset', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 with message when no demo services found', async () => {
    const supabase = makeMockSupabase({
      servicesList: { data: [], error: null },
    })
    mockCreateClient.mockResolvedValue(supabase as any)

    const req = new NextRequest('http://localhost/api/demo/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-abc' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.message).toContain('No demo services')
  })

  it('returns 500 when NEXT_PUBLIC_DEMO_EMAIL is not configured', async () => {
    delete process.env.NEXT_PUBLIC_DEMO_EMAIL
    const supabase = makeMockSupabase()
    mockCreateClient.mockResolvedValue(supabase as any)

    const req = new NextRequest('http://localhost/api/demo/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-abc' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
