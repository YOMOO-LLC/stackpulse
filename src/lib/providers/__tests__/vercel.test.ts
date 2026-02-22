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

const mockProjects = (projects: Array<{ aliases?: string[] }>) => ({
  ok: true,
  json: async () => ({
    projects: projects.map((p, i) => ({
      id: `proj-${i}`,
      name: `project-${i}`,
      alias: p.aliases ?? [],
    })),
    pagination: {},
  }),
} as Response)

const mockUsage = (value: number) => ({
  ok: true,
  json: async () => ({ edgeUsage: { gb: value } }),
} as Response)

const mockRequests = (value: number) => ({
  ok: true,
  json: async () => ({ requestsUsage: { total: value } }),
} as Response)

describe('fetchVercelMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns all 4 metrics correctly when all APIs succeed', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))                         // /v2/user
      .mockResolvedValueOnce(mockProjects([                              // /v9/projects
        { aliases: ['example.com', 'www.example.com'] },
        { aliases: ['api.myapp.com'] },
      ]))
      .mockResolvedValueOnce(mockDeployments([                           // /v9/deployments
        { readyState: 'READY' },
        { readyState: 'READY' },
        { readyState: 'BUILDING' },
      ]))
      .mockResolvedValueOnce(mockUsage(4.2))                             // /v2/usage?type=edge
      .mockResolvedValueOnce(mockRequests(128000))                       // /v2/usage?type=requests

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24h).toBe(3)
    expect(result.deployments24hBreakdown).toEqual({ ready: 2, building: 1, error: 0 })
    expect(result.bandwidthUsed).toBe(4.2)
    expect(result.serverlessInvocations).toBe(128000)
    expect(result.activeDomains).toBe(3)
    expect(result.status).toBe('healthy')
  })

  it('counts deployments by readyState (ready/building/error)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([]))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'READY' },
        { readyState: 'READY' },
        { readyState: 'BUILDING' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'READY' },
      ]))
      .mockResolvedValueOnce(mockUsage(1.0))
      .mockResolvedValueOnce(mockRequests(500))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24h).toBe(6)
    expect(result.deployments24hBreakdown).toEqual({ ready: 3, building: 1, error: 2 })
  })

  it('counts active domains excluding .vercel.app aliases', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([
        { aliases: ['example.com', 'proj-0.vercel.app'] },
        { aliases: ['api.mysite.com', 'proj-1.vercel.app', 'cdn.mysite.com'] },
        { aliases: ['proj-2.vercel.app'] },  // only vercel.app → not counted
      ]))
      .mockResolvedValueOnce(mockDeployments([]))
      .mockResolvedValueOnce(mockUsage(0))
      .mockResolvedValueOnce(mockRequests(0))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.activeDomains).toBe(3) // example.com, api.mysite.com, cdn.mysite.com
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401, text: async () => '' } as Response)

    const result = await fetchVercelMetrics('bad-token')

    expect(result.status).toBe('unknown')
    expect(result.deployments24h).toBeNull()
    expect(result.bandwidthUsed).toBeNull()
    expect(result.serverlessInvocations).toBeNull()
    expect(result.activeDomains).toBeNull()
  })

  it('falls back to /v2/teams when user has no defaultTeamId', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser(null))                             // /v2/user → no defaultTeamId
      .mockResolvedValueOnce(mockTeams('team-xyz'))                      // /v2/teams → fallback
      .mockResolvedValueOnce(mockProjects([{ aliases: ['site.com'] }]))  // /v9/projects
      .mockResolvedValueOnce(mockDeployments([{ readyState: 'READY' }])) // /v9/deployments
      .mockResolvedValueOnce(mockUsage(2.0))                             // /v2/usage?type=edge
      .mockResolvedValueOnce(mockRequests(1000))                         // /v2/usage?type=requests

    const result = await fetchVercelMetrics('vercel_token')

    const calls = vi.mocked(global.fetch).mock.calls
    // Should have called /v2/teams
    expect(calls.some(c => String(c[0]).includes('/v2/teams'))).toBe(true)
    // Projects call should use the fallback teamId
    const projCall = calls.find(c => String(c[0]).includes('projects'))
    expect(projCall?.[0]).toContain('teamId=team-xyz')
    // Deployments call should use the fallback teamId
    const depCall = calls.find(c => String(c[0]).includes('deployments'))
    expect(depCall?.[0]).toContain('teamId=team-xyz')

    expect(result.activeDomains).toBe(1)
    expect(result.deployments24h).toBe(1)
  })

  it('status is warning when 1-2 error deployments', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([]))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'READY' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
      ]))
      .mockResolvedValueOnce(mockUsage(10.0))
      .mockResolvedValueOnce(mockRequests(5000))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24hBreakdown?.error).toBe(2)
    expect(result.status).toBe('warning')
  })

  it('status is critical when 3+ error deployments', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([]))
      .mockResolvedValueOnce(mockDeployments([
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'READY' },
      ]))
      .mockResolvedValueOnce(mockUsage(10.0))
      .mockResolvedValueOnce(mockRequests(5000))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.deployments24hBreakdown?.error).toBe(3)
    expect(result.status).toBe('critical')
  })

  it('status is critical when bandwidth > 90', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([]))
      .mockResolvedValueOnce(mockDeployments([{ readyState: 'READY' }]))
      .mockResolvedValueOnce(mockUsage(95.0))
      .mockResolvedValueOnce(mockRequests(5000))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.bandwidthUsed).toBe(95.0)
    expect(result.status).toBe('critical')
  })

  it('status is warning when bandwidth between 70 and 90', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([]))
      .mockResolvedValueOnce(mockDeployments([{ readyState: 'READY' }]))
      .mockResolvedValueOnce(mockUsage(75.0))
      .mockResolvedValueOnce(mockRequests(5000))

    const result = await fetchVercelMetrics('vercel_token')

    expect(result.bandwidthUsed).toBe(75.0)
    expect(result.status).toBe('warning')
  })
})
