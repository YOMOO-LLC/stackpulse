import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/qstash', () => ({
  unregisterServiceSchedule: vi.fn().mockResolvedValue(undefined),
}))

import { createClient } from '@/lib/supabase/server'
import { PATCH, DELETE } from '../route'

const MOCK_USER = { id: 'user-1' }

function makeParams(id: string) {
  return Promise.resolve({ id })
}

function makePatchClient(result: { data: unknown; error: null | { message: string } }) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  }
}

function makeDeleteClient() {
  const selectResult = { data: { qstash_schedule_id: null }, error: null }
  const deleteResult = { error: null }
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
  }
  const deleteChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: typeof deleteResult) => void) => resolve(deleteResult)),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(deleteChain),
  }
}

function makePatchReq(body: object) {
  return new Request('http://localhost/api/services/svc-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/services/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    const client = makePatchClient({ data: null, error: null })
    client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(client as never)
    const res = await PATCH(makePatchReq({ label: 'New Name' }) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(401)
  })

  it('returns 400 when label is empty string', async () => {
    vi.mocked(createClient).mockResolvedValue(makePatchClient({ data: null, error: null }) as never)
    const res = await PATCH(makePatchReq({ label: '   ' }) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(400)
  })

  it('returns 400 when label is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(makePatchClient({ data: null, error: null }) as never)
    const res = await PATCH(makePatchReq({}) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(400)
  })

  it('returns 200 with updated service on success', async () => {
    const updated = { id: 'svc-1', label: 'New Name' }
    vi.mocked(createClient).mockResolvedValue(makePatchClient({ data: updated, error: null }) as never)
    const res = await PATCH(makePatchReq({ label: 'New Name' }) as never, { params: makeParams('svc-1') })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.label).toBe('New Name')
  })
})

describe('DELETE /api/services/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    const client = makeDeleteClient()
    client.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(client as never)
    const res = await DELETE(
      new Request('http://localhost/api/services/svc-1') as never,
      { params: makeParams('svc-1') }
    )
    expect(res.status).toBe(401)
  })

  it('returns 204 on successful delete', async () => {
    vi.mocked(createClient).mockResolvedValue(makeDeleteClient() as never)
    const res = await DELETE(
      new Request('http://localhost/api/services/svc-1') as never,
      { params: makeParams('svc-1') }
    )
    expect(res.status).toBe(204)
  })
})
