import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/ssr before importing middleware
const mockGetUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

// Mock next/server
const mockCookiesGetAll = vi.fn()
const mockCookiesSet = vi.fn()
const mockResponseCookiesSet = vi.fn()

vi.mock('next/server', () => {
  class MockNextResponse {
    cookies = { set: mockResponseCookiesSet }
    static next() {
      return new MockNextResponse()
    }
  }
  return { NextResponse: MockNextResponse }
})

import { middleware } from '../middleware'

function makeRequest(cookies: Array<{ name: string; value: string }> = []) {
  mockCookiesGetAll.mockReturnValue(cookies)
  return {
    cookies: {
      getAll: mockCookiesGetAll,
      set: mockCookiesSet,
    },
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('middleware', () => {
  it('calls getUser and returns response on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '123' } }, error: null })
    const req = makeRequest()

    const response = await middleware(req)

    expect(mockGetUser).toHaveBeenCalledOnce()
    expect(response).toBeDefined()
  })

  it('does not hang when getUser throws (invalid refresh token)', async () => {
    mockGetUser.mockRejectedValue(new Error('Invalid Refresh Token: Refresh Token Not Found'))
    const req = makeRequest([
      { name: 'sb-127-auth-token', value: 'stale-token' },
      { name: 'sb-127-auth-token-code-verifier', value: 'verifier' },
      { name: 'other-cookie', value: 'keep-me' },
    ])

    const response = await middleware(req)

    // Should return a response (not hang or throw)
    expect(response).toBeDefined()
    // Should clear sb-* cookies to prevent retry loops
    expect(mockResponseCookiesSet).toHaveBeenCalledWith('sb-127-auth-token', '', { maxAge: 0, path: '/' })
    expect(mockResponseCookiesSet).toHaveBeenCalledWith('sb-127-auth-token-code-verifier', '', { maxAge: 0, path: '/' })
    // Should NOT clear non-Supabase cookies
    const clearedNames = mockResponseCookiesSet.mock.calls.map((c: any[]) => c[0])
    expect(clearedNames).not.toContain('other-cookie')
  })

  it('recovers when getUser hangs (times out after 5s)', async () => {
    // Simulate getUser that never resolves
    mockGetUser.mockReturnValue(new Promise(() => {}))
    const req = makeRequest([
      { name: 'sb-127-auth-token', value: 'stale-token' },
    ])

    const response = await middleware(req)

    // Should return a response after timeout (not hang forever)
    expect(response).toBeDefined()
    // Should clear stale auth cookies
    expect(mockResponseCookiesSet).toHaveBeenCalledWith('sb-127-auth-token', '', { maxAge: 0, path: '/' })
  }, 10000)

  it('does not clear cookies on successful getUser', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '123' } }, error: null })
    const req = makeRequest([
      { name: 'sb-127-auth-token', value: 'valid-token' },
    ])

    await middleware(req)

    // Response cookie set should not be called to clear tokens
    const clearCalls = mockResponseCookiesSet.mock.calls.filter(
      (c: any[]) => c[1] === '' && c[2]?.maxAge === 0
    )
    expect(clearCalls).toHaveLength(0)
  })
})
