import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('projects route — fetch project options', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns project options from provider projectSelector', async () => {
    const mockFetch = vi.fn().mockResolvedValue([
      { value: 'proj-abc', label: 'My Project' },
      { value: 'proj-def', label: 'Another Project' },
    ])
    mockGetProvider.mockReturnValue({
      id: 'supabase', name: 'Supabase', category: 'infrastructure', icon: '',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn(),
      projectSelector: { key: 'project_ref', label: 'Select Project', fetch: mockFetch },
    })

    const res = await POST(makeReq({ providerId: 'supabase', credentials: { token: 'sbp_test' } }) as never)
    const body = await res.json()
    expect(body.options).toHaveLength(2)
    expect(body.options[0]).toEqual({ value: 'proj-abc', label: 'My Project' })
    expect(mockFetch).toHaveBeenCalledWith({ token: 'sbp_test' })
  })

  it('returns 400 for unknown provider', async () => {
    mockGetProvider.mockReturnValue(undefined as never)
    const res = await POST(makeReq({ providerId: 'nope', credentials: {} }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for provider without projectSelector', async () => {
    mockGetProvider.mockReturnValue({
      id: 'openrouter', name: 'OpenRouter', category: 'ai', icon: '',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn(),
    })
    const res = await POST(makeReq({ providerId: 'openrouter', credentials: {} }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/project selection/)
  })

  it('returns empty options on fetch error', async () => {
    mockGetProvider.mockReturnValue({
      id: 'supabase', name: 'Supabase', category: 'infrastructure', icon: '',
      authType: 'api_key', credentials: [], collectors: [], alerts: [],
      fetchMetrics: vi.fn(),
      projectSelector: {
        key: 'project_ref', label: 'Select Project',
        fetch: vi.fn().mockRejectedValue(new Error('network fail')),
      },
    })
    const res = await POST(makeReq({ providerId: 'supabase', credentials: { token: 'bad' } }) as never)
    const body = await res.json()
    expect(body.options).toEqual([])
  })
})
