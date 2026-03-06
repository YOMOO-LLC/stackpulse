import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/subscription', () => ({
  getUserPlan: vi.fn(),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted:', '')),
}))

import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { encrypt } from '@/lib/crypto'
import { GET, POST } from '../route'

const MOCK_USER = { id: 'user-1', email: 'dev@stackpulse.local' }

// Set ENCRYPTION_KEY for tests
process.env.ENCRYPTION_KEY = 'a'.repeat(64)

function makePostReq(body: object) {
  return new Request('http://localhost/api/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabaseWithChannels(channels: object[] = []) {
  const upsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'ch-1' }, error: null }),
    }),
  })
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: channels, error: null }),
      }),
      upsert: upsertMock,
    }),
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return { client, upsertMock }
}

describe('GET /api/channels — includes slack channel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns email channel and saved slack channel', async () => {
    const slackChannel = {
      id: 'ch-1',
      type: 'slack',
      name: 'Slack',
      config: 'encrypted:{"webhook_url":"https://hooks.slack.com/services/T00/B00/xxx"}',
      enabled: true,
    }
    mockSupabaseWithChannels([slackChannel])

    const res = await GET()
    const json = await res.json()

    expect(json.channels).toBeDefined()
    expect(json.channels.length).toBe(2) // email + slack
    const emailCh = json.channels.find((c: { type: string }) => c.type === 'email')
    expect(emailCh).toBeDefined()
  })

  it('returns slack channel with decrypted webhook_url', async () => {
    const slackChannel = {
      id: 'ch-1',
      type: 'slack',
      name: 'Slack',
      config: 'encrypted:{"webhook_url":"https://hooks.slack.com/services/T00/B00/xxx"}',
      enabled: true,
    }
    mockSupabaseWithChannels([slackChannel])

    const res = await GET()
    const json = await res.json()

    const slackCh = json.channels.find((c: { type: string }) => c.type === 'slack')
    expect(slackCh).toBeDefined()
    expect(slackCh.config.webhook_url).toBe('https://hooks.slack.com/services/T00/B00/xxx')
  })
})

describe('POST /api/channels — save slack webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves slack webhook URL with encryption', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'pro',
      limits: {
        maxServices: 15,
        pollCron: '*/15 * * * *',
        maxAlertRules: 20,
        maxTeamMembers: 3,
        retentionDays: 30,
        channels: ['email', 'slack'],
      },
    })
    const { client } = mockSupabaseWithChannels()

    const res = await POST(makePostReq({
      type: 'slack',
      config: { webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx' },
    }) as never)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    // Verify encrypt was called with the webhook URL config
    expect(encrypt).toHaveBeenCalledWith(
      JSON.stringify({ webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx' }),
      'a'.repeat(64)
    )

    // Verify upsert was called on notification_channels
    expect(client.from).toHaveBeenCalledWith('notification_channels')
  })

  it('rejects slack on free plan', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'free',
      limits: {
        maxServices: 3,
        pollCron: '0 * * * *',
        maxAlertRules: 3,
        maxTeamMembers: 1,
        retentionDays: 7,
        channels: ['email'],
      },
    })
    mockSupabaseWithChannels()

    const res = await POST(makePostReq({
      type: 'slack',
      config: { webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx' },
    }) as never)

    expect(res.status).toBe(403)
  })

  it('rejects slack without webhook_url', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'pro',
      limits: {
        maxServices: 15,
        pollCron: '*/15 * * * *',
        maxAlertRules: 20,
        maxTeamMembers: 3,
        retentionDays: 30,
        channels: ['email', 'slack'],
      },
    })
    mockSupabaseWithChannels()

    const res = await POST(makePostReq({
      type: 'slack',
      config: {},
    }) as never)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/webhook/i)
  })
})
