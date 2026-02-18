import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '../route'

const MOCK_USER = { id: 'user-1' }
const MOCK_ALERT = {
  id: 'alert-1',
  connected_service_id: 'svc-1',
  collector_id: 'credit_balance',
  condition: 'lt',
  threshold_numeric: 5,
  threshold_text: null,
  enabled: true,
  created_at: new Date().toISOString(),
}

function makeMockClient(overrides = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: MOCK_ALERT, error: null }),
    order: vi.fn().mockResolvedValue({ data: [MOCK_ALERT], error: null }),
    ...overrides,
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  }
}

describe('GET /api/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeMockClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const req = new Request('http://localhost/api/alerts?serviceId=svc-1')
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when serviceId is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = new Request('http://localhost/api/alerts')
    const res = await GET(req as never)
    expect(res.status).toBe(400)
  })

  it('returns alert configs for a service', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = new Request('http://localhost/api/alerts?serviceId=svc-1')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })
})

describe('POST /api/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeMockClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const req = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected_service_id: 'svc-1', collector_id: 'credit_balance', condition: 'lt', threshold_numeric: 5, enabled: true }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('creates an alert config and returns 201', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected_service_id: 'svc-1', collector_id: 'credit_balance', condition: 'lt', threshold_numeric: 5, enabled: true }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
  })
})
