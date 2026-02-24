import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock session-based Supabase client (anon key)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock service-role Supabase client (used for adminSupabase in the route)
vi.mock('@supabase/supabase-js', () => ({
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
import { createClient as createServiceClient } from '@supabase/supabase-js'
const mockCreateClient = vi.mocked(createClient)
const mockCreateServiceClient = vi.mocked(createServiceClient)

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
      DEMO_USER_ID: 'demo-user-id',
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }
  })

  afterAll(() => { process.env = OLD_ENV })

  function setupMocks(overrides: Parameters<typeof makeMockSupabase>[0] = {}) {
    const supabase = makeMockSupabase(overrides)
    mockCreateClient.mockResolvedValue(supabase as any)
    mockCreateServiceClient.mockReturnValue(supabase as any)
    return supabase
  }

  it('returns 401 when no Authorization header and no session', async () => {
    setupMocks()
    const req = new NextRequest('http://localhost/api/demo/reset', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when Bearer token is wrong', async () => {
    setupMocks()
    const req = new NextRequest('http://localhost/api/demo/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct Bearer token', async () => {
    setupMocks({ servicesList: { data: [{ id: 'svc-1', provider_id: 'github' }], error: null } })
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
    setupMocks({
      getUser: { data: { user: { email: 'demo@stackpulse.io' } } },
      servicesList: { data: [{ id: 'svc-1', provider_id: 'github' }], error: null },
    })
    const req = new NextRequest('http://localhost/api/demo/reset', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 with message when no demo services found', async () => {
    setupMocks({ servicesList: { data: [], error: null } })
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
    setupMocks()
    const req = new NextRequest('http://localhost/api/demo/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-abc' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
