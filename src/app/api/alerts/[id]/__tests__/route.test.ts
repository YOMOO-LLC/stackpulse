import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { PATCH, DELETE } from '../route'

const MOCK_USER = { id: 'user-1' }
const MOCK_ALERT = {
  id: 'alert-1',
  connected_service_id: 'svc-1',
  collector_id: 'credit_balance',
  condition: 'lt',
  threshold_numeric: 3,
  threshold_text: null,
  enabled: false,
  created_at: new Date().toISOString(),
}

function makeParams(id: string) {
  return Promise.resolve({ id })
}

function makePatchClient() {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: MOCK_ALERT, error: null }),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  }
}

function makeDeleteClient() {
  const result = { error: null }
  const chain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: typeof result) => void) => resolve(result)),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  }
}

describe('PATCH /api/alerts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makePatchClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const req = new Request('http://localhost/api/alerts/alert-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    const res = await PATCH(req as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(401)
  })

  it('updates the alert and returns it', async () => {
    vi.mocked(createClient).mockResolvedValue(makePatchClient() as never)
    const req = new Request('http://localhost/api/alerts/alert-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    const res = await PATCH(req as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('alert-1')
  })
})

describe('DELETE /api/alerts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeDeleteClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const res = await DELETE(new Request('http://localhost/api/alerts/alert-1') as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(401)
  })

  it('returns 204 on successful delete', async () => {
    vi.mocked(createClient).mockResolvedValue(makeDeleteClient() as never)
    const res = await DELETE(new Request('http://localhost/api/alerts/alert-1') as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(204)
  })
})
