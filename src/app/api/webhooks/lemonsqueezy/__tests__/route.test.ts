import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import crypto from 'node:crypto'

const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
    }),
  }),
}))

vi.mock('@/lib/lemonsqueezy', () => ({
  VARIANT_TO_PLAN: { '12345': { plan: 'pro', cycle: 'monthly' } },
}))

const WEBHOOK_SECRET = 'test-secret-123'

function makeWebhookRequest(eventName: string, data: object, customData?: object) {
  const body = JSON.stringify({
    meta: { event_name: eventName, custom_data: customData ?? { user_id: 'u1' } },
    data: { id: 'sub_123', attributes: data },
  })

  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  return new Request('http://localhost', {
    method: 'POST',
    body,
    headers: { 'X-Signature': signature },
  })
}

describe('POST /api/webhooks/lemonsqueezy', () => {
  beforeAll(() => {
    vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_SECRET)
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles subscription_created event', async () => {
    const { POST } = await import('../route')
    const req = makeWebhookRequest('subscription_created', {
      customer_id: 456,
      variant_id: 12345,
      status: 'active',
      renews_at: '2026-04-01T00:00:00Z',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        plan: 'pro',
        billing_cycle: 'monthly',
        ls_customer_id: '456',
        ls_subscription_id: 'sub_123',
        ls_variant_id: '12345',
        current_period_end: '2026-04-01T00:00:00Z',
      }),
      { onConflict: 'user_id' },
    )
  })

  it('handles subscription_updated event', async () => {
    const { POST } = await import('../route')
    const req = makeWebhookRequest('subscription_updated', {
      customer_id: 456,
      variant_id: 12345,
      status: 'active',
      renews_at: '2026-05-01T00:00:00Z',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('handles subscription_cancelled event', async () => {
    const { POST } = await import('../route')
    const req = makeWebhookRequest('subscription_cancelled', {
      customer_id: 456,
      variant_id: 12345,
      status: 'cancelled',
      renews_at: null,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free' }),
    )
  })

  it('handles subscription_expired event', async () => {
    const { POST } = await import('../route')
    const req = makeWebhookRequest('subscription_expired', {
      customer_id: 456,
      variant_id: 12345,
      status: 'expired',
      renews_at: null,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('returns 400 for invalid signature', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '{"meta":{"event_name":"subscription_created"},"data":{}}',
      headers: { 'X-Signature': 'invalid-sig' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing signature header', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '{"meta":{"event_name":"subscription_created"},"data":{}}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when subscription_created has no user_id', async () => {
    const { POST } = await import('../route')
    const req = makeWebhookRequest(
      'subscription_created',
      { customer_id: 456, variant_id: 12345, status: 'active', renews_at: null },
      {},
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when webhook secret is not configured', async () => {
    vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', '')
    // Re-import to pick up env change
    vi.resetModules()

    // Re-mock dependencies after resetModules
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert,
          update: mockUpdate,
        }),
      }),
    }))
    vi.doMock('@/lib/lemonsqueezy', () => ({
      VARIANT_TO_PLAN: { '12345': { plan: 'pro', cycle: 'monthly' } },
    }))

    const { POST } = await import('../route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'test',
      headers: { 'X-Signature': 'abc' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)

    // Restore
    vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_SECRET)
  })
})
