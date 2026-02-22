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

const mockProjects = (projects: Array<{ readyState: string; createdAt?: number }>) => ({
  ok: true,
  json: async () => ({
    projects: projects.map((p, i) => ({
      id: `proj-${i}`,
      name: `project-${i}`,
      latestDeployments: [{
        readyState: p.readyState,
        createdAt: p.createdAt ?? (1000000 + i * 1000),
        url: `proj-${i}.vercel.app`,
      }],
    })),
    pagination: {},
  }),
} as Response)

describe('fetchVercelMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns project stats when all projects are healthy', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([
        { readyState: 'READY', createdAt: 2000 },
        { readyState: 'READY', createdAt: 3000 },
        { readyState: 'READY', createdAt: 1000 },
      ]))

    const result = await fetchVercelMetrics('vercel_token')
    expect(result.totalProjects).toBe(3)
    expect(result.projectsFailing).toBe(0)
    expect(result.latestDeploymentStatus).toBe('READY')
    expect(result.status).toBe('healthy')
  })

  it('returns warning when some projects are failing', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([
        { readyState: 'READY', createdAt: 2000 },
        { readyState: 'ERROR', createdAt: 1000 },
      ]))

    const result = await fetchVercelMetrics('vercel_token')
    expect(result.projectsFailing).toBe(1)
    expect(result.status).toBe('warning')
  })

  it('returns critical when 3 or more projects are failing', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'ERROR' },
        { readyState: 'READY' },
      ]))

    const result = await fetchVercelMetrics('vercel_token')
    expect(result.projectsFailing).toBe(3)
    expect(result.status).toBe('critical')
  })

  it('picks the most recent deployment as latestDeploymentStatus', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-1'))
      .mockResolvedValueOnce(mockProjects([
        { readyState: 'READY', createdAt: 1000 },
        { readyState: 'ERROR', createdAt: 9999 }, // most recent
        { readyState: 'READY', createdAt: 5000 },
      ]))

    const result = await fetchVercelMetrics('vercel_token')
    expect(result.latestDeploymentStatus).toBe('ERROR')
  })

  it('falls back to /v2/teams when user has no defaultTeamId', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser(null))
      .mockResolvedValueOnce(mockTeams('team-xyz'))
      .mockResolvedValueOnce(mockProjects([{ readyState: 'READY' }]))

    const result = await fetchVercelMetrics('vercel_token')
    const calls = vi.mocked(global.fetch).mock.calls
    const projCall = calls.find(c => String(c[0]).includes('projects'))
    expect(projCall?.[0]).toContain('teamId=team-xyz')
    expect(result.totalProjects).toBe(1)
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401, text: async () => '' } as Response)
    const result = await fetchVercelMetrics('bad-token')
    expect(result.status).toBe('unknown')
    expect(result.totalProjects).toBeNull()
  })

  it('includes teamId in projects URL when user has defaultTeamId', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockUser('team-abc123'))
      .mockResolvedValueOnce(mockProjects([{ readyState: 'READY' }]))

    await fetchVercelMetrics('vercel_token')
    const calls = vi.mocked(global.fetch).mock.calls
    const projCall = calls.find(c => String(c[0]).includes('projects'))
    expect(projCall?.[0]).toContain('teamId=team-abc123')
  })
})
