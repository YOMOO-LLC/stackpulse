import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn().mockResolvedValue({ items: { data: [{ price: { id: 'price_pro' } }] }, current_period_end: 1735689600 }) },
  },
  PRICE_TO_PLAN: { 'price_pro': { plan: 'pro', cycle: 'monthly' } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    }),
  }),
}))

import { stripe } from '@/lib/stripe'
import { POST } from '../route'

describe('POST /api/stripe/webhook', () => {
  it('handles checkout.session.completed event', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'u1' },
          customer: 'cus_123',
          subscription: 'sub_456',
        },
      },
    } as any)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'sig_test' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid signature', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => { throw new Error('bad sig') })

    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'bad-body',
      headers: { 'stripe-signature': 'bad_sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
