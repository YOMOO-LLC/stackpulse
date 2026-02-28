import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchVercelMetrics } from '../vercel'

const mockUser = (teamId: string | null = null) => ({
  ok: true,
  json: async () => ({ user: { defaultTeamId: teamId } }),
} as Response)

const mockTeams = (teamId: string | null = 'team-default') => ({
  ok: teamId !== null,
  json: async () => ({ teams: teamId ? [{ id: teamId }] : [] }),
} as Response)

const mockDeployments = (deployments: Array<{ readyState: string }>) => ({
  ok: true,
  json: async () => ({
    deployments: deployments.map((d, i) => ({
      uid: `dep-${i}`,
      readyState: d.readyState,
      createdAt: Date.now() - i * 1000,
    })),
    pagination: {},
  }),
} as Response)

const mockProjects = (count: number) => ({
  ok: true,
  json: async () => ({
    projects: Array.from({ length: count }, (_, i) => ({
      id: `proj-${i}`,
      name: `project-${i}`,
    })),
    pagination: {},
  }),
} as Response)

const mockUsage = (invocations: number) => ({
  ok: true,
  json: async () => ({
    data: [{ worker_invocation_count: invocations }],
  }),
} as Response)

const mockUsageFail = () => ({
  ok: false,
  status: 400,
} as Response)

describe('fetchVercelMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns all metrics correctly when all APIs succeed', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))                         // /v2/user
      .mockResolvedValueOnce(mockProjects(5))                            // /v9/projects
      .mockResolvedValueOnce(mockDeployments([                           // /v6/deployments
        { readyState: 'READY' },
        { readyState: 'READY' },
        { readyState: 'BUILDING' },
      ]))
      .mockResolvedValueOnce(mockUsage(128000))                          // /v2/usage

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24h).toBe(3)
    expect(result.deployments24hBreakdown).toEqual({ ready: 2, building: 1, error: 0 })
    expect(result.serverlessInvocations).toBe(128000)
    expect(result.projectCount).toBe(5)
    expect(result.deploySuccessRate).toBe(67) // Math.round(2/3 * 100)
    expect(result.status).toBe('healthy')
  })

  it('counts deployments by readyState (ready/building/error)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(0))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'READY' },
        { readyState: 'READY' },
        { readyState: 'BUILDING' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'READY' },
      ]))
      .mockResolvedValueOnce(mockUsage(500))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24h).toBe(6)
    expect(result.deployments24hBreakdown).toEqual({ ready: 3, building: 1, error: 2 })
  })

  it('returns projectCount from projects array length', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(12))
      .mockResolvedValueOnce(mockDeployments([]))
      .mockResolvedValueOnce(mockUsage(0))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.projectCount).toBe(12)
  })

  it('deploySuccessRate is 100 when no deployments', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(1))
      .mockResolvedValueOnce(mockDeployments([]))
      .mockResolvedValueOnce(mockUsage(0))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deploySuccessRate).toBe(100)
  })

  it('deploySuccessRate is 0 when all deployments fail', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(1))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
      ]))
      .mockResolvedValueOnce(mockUsage(0))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deploySuccessRate).toBe(0)
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401, text: async () => '' } as Response)

    const result = await fetchVercelMetrics('bad-token')

    expect(result.status).toBe('unknown')
    expect(result.deployments24h).toBeNull()
    expect(result.projectCount).toBeNull()
    expect(result.deploySuccessRate).toBeNull()
    expect(result.serverlessInvocations).toBeNull()
  })

  it('falls back to /v2/teams when user has no defaultTeamId', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser(null))                             // /v2/user → no defaultTeamId
      .mockResolvedValueOnce(mockTeams('team-xyz'))                      // /v2/teams → fallback
      .mockResolvedValueOnce(mockProjects(3))                            // /v9/projects
      .mockResolvedValueOnce(mockDeployments([{ readyState: 'READY' }])) // /v6/deployments
      .mockResolvedValueOnce(mockUsage(1000))                            // /v2/usage

    const result = await fetchVercelMetrics('vercel_token')

    const calls = vi.mocked(global.fetch).mock.calls
    expect(calls.some(c => String(c[0]).includes('/v2/teams'))).toBe(true)
    const projCall = calls.find(c => String(c[0]).includes('projects'))
    expect(projCall?.[0]).toContain('teamId=team-xyz')

    expect(result.projectCount).toBe(3)
    expect(result.deployments24h).toBe(1)
    expect(result.deploySuccessRate).toBe(100)
  })

  it('status is warning when 1-2 error deployments', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(0))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'READY' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
      ]))
      .mockResolvedValueOnce(mockUsage(5000))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24hBreakdown?.error).toBe(2)
    expect(result.status).toBe('warning')
  })

  it('status is critical when 3+ error deployments', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(0))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'READY' },
      ]))
      .mockResolvedValueOnce(mockUsage(5000))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24hBreakdown?.error).toBe(3)
    expect(result.status).toBe('critical')
  })

  it('sums worker_invocation_count across multiple days', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(0))
      .mockResolvedValueOnce(mockDeployments([{ readyState: 'READY' }]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { worker_invocation_count: 500 },
            { worker_invocation_count: 300 },
            { worker_invocation_count: 200 },
          ],
        }),
      } as Response)

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.serverlessInvocations).toBe(1000)
  })

  it('returns null serverlessInvocations when usage API fails', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects(0))
      .mockResolvedValueOnce(mockDeployments([{ readyState: 'READY' }]))
      .mockResolvedValueOnce(mockUsageFail())

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.serverlessInvocations).toBeNull()
    expect(result.status).toBe('healthy')
  })
})
