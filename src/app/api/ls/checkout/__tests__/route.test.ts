import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u1', email: 'test@test.com' } },
        error: null,
      }),
    },
  }),
}))

vi.mock('@/lib/lemonsqueezy', () => ({
  configureLemonSqueezy: vi.fn(),
  createCheckout: vi.fn().mockResolvedValue({
    data: {
      data: {
        attributes: {
          url: 'https://stackpulse.lemonsqueezy.com/checkout/xxx',
        },
      },
    },
  }),
}))

import { POST } from '../route'

describe('POST /api/ls/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns checkout URL', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ variantId: 123456 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('lemonsqueezy.com')
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('No user'),
        }),
      },
    } as any)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ variantId: 123456 }),
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
})
