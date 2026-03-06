import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/lemonsqueezy', () => ({
  configureLemonSqueezy: vi.fn(),
  updateSubscription: vi.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { updateSubscription } from '@/lib/lemonsqueezy'

function setupAuth(user: { id: string; email: string } | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('No user'),
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  } as any)
}

describe('POST /api/ls/switch-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth({ id: 'u1', email: 'test@test.com' })
    mockSingle.mockResolvedValue({
      data: { ls_subscription_id: 'sub_123' },
      error: null,
    })
    vi.mocked(updateSubscription).mockResolvedValue({
      data: { data: { id: 'sub_123' } },
      error: null,
    } as any)
  })

  it('switches plan successfully', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ variantId: 654321 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(updateSubscription).toHaveBeenCalledWith('sub_123', {
      variantId: 654321,
      invoiceImmediately: true,
    })
  })

  it('returns 401 when not authenticated', async () => {
    setupAuth(null)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ variantId: 654321 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when variantId missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when no subscription found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ variantId: 654321 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 500 when LS API fails', async () => {
    vi.mocked(updateSubscription).mockResolvedValueOnce({
      data: null,
      error: { message: 'API error' },
    } as any)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ variantId: 654321 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
