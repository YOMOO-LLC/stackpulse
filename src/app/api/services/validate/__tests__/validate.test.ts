import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}))

vi.mock('@/lib/providers', () => ({
  getProvider: vi.fn(),
}))

import { getProvider } from '@/lib/providers'
import { POST } from '../route'

const mockGetProvider = vi.mocked(getProvider)

function makeReq(body: object) {
  return { json: async () => body } as unknown as Request
}

describe('validate route — generic provider validation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns valid=true when provider fetchMetrics returns healthy status', async () => {
    mockGetProvider.mockReturnValue({
      id: 'supabase', name: 'Supabase', category: 'infrastructure', icon: '/icons/supabase.svg',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn().mockResolvedValue([
        { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy' },
      ]),
    })
    const res = await POST(makeReq({ providerId: 'supabase', credentials: { token: 'sbp_valid' } }) as never)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.status).toBe('healthy')
  })

  it('returns valid=false when all metrics return unknown status', async () => {
    mockGetProvider.mockReturnValue({
      id: 'supabase', name: 'Supabase', category: 'infrastructure', icon: '/icons/supabase.svg',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn().mockResolvedValue([
        { collectorId: 'connection_status', value: null, valueText: null, unit: '', status: 'unknown' },
      ]),
    })
    const res = await POST(makeReq({ providerId: 'supabase', credentials: { token: 'bad' } }) as never)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })

  it('returns valid=true when at least one metric is not unknown', async () => {
    mockGetProvider.mockReturnValue({
      id: 'openrouter', name: 'OpenRouter', category: 'ai', icon: '/icons/openrouter.svg',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn().mockResolvedValue([
        { collectorId: 'credit_balance', value: 10, status: 'healthy' },
        { collectorId: 'requests_24h', value: null, status: 'unknown' },
      ]),
    })
    const res = await POST(makeReq({ providerId: 'openrouter', credentials: { apiKey: 'sk-or-xxx' } }) as never)
    const body = await res.json()
    expect(body.valid).toBe(true)
  })

  it('passes credentials through to fetchMetrics', async () => {
    const mockFetch = vi.fn().mockResolvedValue([
      { collectorId: 'connection_status', status: 'healthy' },
    ])
    mockGetProvider.mockReturnValue({
      id: 'supabase', name: 'Supabase', category: 'infrastructure', icon: '/icons/supabase.svg',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: mockFetch,
    })
    await POST(makeReq({ providerId: 'supabase', credentials: { token: 'sbp_test123' } }) as never)
    expect(mockFetch).toHaveBeenCalledWith({ token: 'sbp_test123' })
  })

  it('returns valid=false on fetchMetrics error', async () => {
    mockGetProvider.mockReturnValue({
      id: 'supabase', name: 'Supabase', category: 'infrastructure', icon: '/icons/supabase.svg',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn().mockRejectedValue(new Error('network fail')),
    })
    const res = await POST(makeReq({ providerId: 'supabase', credentials: { token: 'sbp_test' } }) as never)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })

  it('returns 400 for unknown provider', async () => {
    mockGetProvider.mockReturnValue(undefined as never)
    const res = await POST(makeReq({ providerId: 'nope', credentials: {} }) as never)
    expect(res.status).toBe(400)
  })
})
