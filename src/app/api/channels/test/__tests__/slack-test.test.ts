import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ id: 'email-1' }) }
  },
}))
vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((text: string) => text.replace('encrypted:', '')),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from '../../test/route'

const MOCK_USER = { id: 'user-1', email: 'dev@stackpulse.local' }

process.env.ENCRYPTION_KEY = 'a'.repeat(64)

function makePostReq(body: object) {
  return new Request('http://localhost/api/channels/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabaseWithSlackChannel(slackChannel?: object) {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: slackChannel ?? null,
              error: slackChannel ? null : { code: 'PGRST116' },
            }),
          }),
        }),
      }),
    }),
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

describe('POST /api/channels/test — Slack test message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true })
  })

  it('sends a Slack test message when type=slack', async () => {
    mockSupabaseWithSlackChannel({
      id: 'ch-1',
      type: 'slack',
      config: 'encrypted:{"webhook_url":"https://hooks.slack.com/services/T00/B00/xxx"}',
    })

    const res = await POST(makePostReq({ type: 'slack' }) as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns 404 when no slack channel is configured', async () => {
    mockSupabaseWithSlackChannel(undefined)

    const res = await POST(makePostReq({ type: 'slack' }) as never)

    expect(res.status).toBe(404)
  })

  it('still sends email test when type is not specified', async () => {
    mockSupabaseWithSlackChannel(undefined)

    const res = await POST(makePostReq({}) as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
  })
})
