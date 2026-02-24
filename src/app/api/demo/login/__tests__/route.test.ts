import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
const mockCreateClient = vi.mocked(createClient)

describe('POST /api/demo/login', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...OLD_ENV,
      NEXT_PUBLIC_DEMO_EMAIL: 'demo@stackpulse.io',
      DEMO_USER_PASSWORD: 'super-secret-password',
      NEXT_PUBLIC_APP_URL: 'http://localhost:4567',
    }
  })

  afterAll(() => { process.env = OLD_ENV })

  it('returns 302 redirect to /dashboard on success', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    } as any)

    const req = new NextRequest('http://localhost/api/demo/login', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('returns 500 when env vars missing', async () => {
    delete process.env.NEXT_PUBLIC_DEMO_EMAIL
    const req = new NextRequest('http://localhost/api/demo/login', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 500 when Supabase signIn fails', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: { message: 'Invalid credentials' } }),
      },
    } as any)

    const req = new NextRequest('http://localhost/api/demo/login', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
