import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

function setupAuth(user: { id: string } | null) {
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

describe('GET /api/subscription/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth({ id: 'u1' })
    mockSingle.mockResolvedValue({
      data: { plan: 'pro' },
      error: null,
    })
  })

  it('returns the current plan', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plan).toBe('pro')
  })

  it('returns 401 when not authenticated', async () => {
    setupAuth(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns free when no subscription found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plan).toBe('free')
  })
})
