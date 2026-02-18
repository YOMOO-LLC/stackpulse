import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchVercelMetrics } from '../vercel'

describe('fetchVercelMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns bandwidth and deployment status', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bandwidthUsage: { gigabytes: 45 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deployments: [{ state: 'READY', url: 'foo.vercel.app' }] }),
      } as Response)

    const result = await fetchVercelMetrics('vercel_token')
    expect(result.bandwidthUsed).toBe(45)
    expect(result.deploymentStatus).toBe('READY')
    expect(result.status).toBe('healthy')
  })

  it('returns critical when deployment failed', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bandwidthUsage: { gigabytes: 10 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deployments: [{ state: 'ERROR', url: 'foo.vercel.app' }] }),
      } as Response)

    const result = await fetchVercelMetrics('vercel_token')
    expect(result.status).toBe('critical')
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await fetchVercelMetrics('bad-token')
    expect(result.status).toBe('unknown')
  })
})
