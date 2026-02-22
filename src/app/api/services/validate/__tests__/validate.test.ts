import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

// Must mock these before importing the module under test
vi.mock('@/lib/providers/openrouter', () => ({
  fetchOpenRouterMetrics: vi.fn(),
}))
vi.mock('@/lib/providers/sentry', () => ({
  fetchSentryMetrics: vi.fn(),
}))
vi.mock('@/lib/providers/resend', () => ({
  fetchResendMetrics: vi.fn(),
}))
vi.mock('@/lib/providers/vercel', () => ({
  fetchVercelMetrics: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}))
vi.mock('@/lib/providers', () => ({
  getProvider: vi.fn().mockReturnValue({ id: 'vercel' }),
}))

import { fetchVercelMetrics } from '@/lib/providers/vercel'
import { POST } from '../route'

function makeReq(body: object) {
  return { json: async () => body } as unknown as Request
}

describe('validate route — vercel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns valid=true when vercel token is healthy', async () => {
    vi.mocked(fetchVercelMetrics).mockResolvedValue({
      totalProjects: 3, projectsFailing: 0, latestDeploymentStatus: 'READY', status: 'healthy',
    })
    const res = await POST(makeReq({ providerId: 'vercel', credentials: { token: 'vercel_abc' } }) as never)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(fetchVercelMetrics).toHaveBeenCalledWith('vercel_abc')
  })

  it('returns valid=false when vercel token is unknown/invalid', async () => {
    vi.mocked(fetchVercelMetrics).mockResolvedValue({
      totalProjects: null, projectsFailing: null, latestDeploymentStatus: null, status: 'unknown', error: 'API error',
    })
    const res = await POST(makeReq({ providerId: 'vercel', credentials: { token: 'bad_token' } }) as never)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })
})
