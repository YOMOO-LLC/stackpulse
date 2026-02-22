import type { ServiceProvider } from './types'

export const vercelProvider: ServiceProvider = {
  id: 'vercel',
  name: 'Vercel',
  category: 'hosting',
  icon: '/icons/vercel.svg',
  authType: 'api_key',
  credentials: [
    { key: 'token', label: 'API Token', type: 'password', required: true, placeholder: 'vercel_...' },
  ],
  collectors: [
    {
      id: 'total_projects',
      name: 'Total Projects',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Number of Vercel projects in your account',
      displayHint: 'number',
    },
    {
      id: 'projects_failing',
      name: 'Projects Failing',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Projects with a failed latest deployment',
      displayHint: 'number',
      thresholds: { warning: 1, critical: 3, direction: 'above', max: 100 },
      trend: true,
    },
    {
      id: 'latest_deployment',
      name: 'Latest Deployment',
      metricType: 'status', unit: '', refreshInterval: 300,
      description: 'State of the most recent deployment across all projects',
      displayHint: 'status-badge',
    },
  ],
  alerts: [
    { id: 'projects-failing', name: 'Projects Failing', collectorId: 'projects_failing', condition: 'gt', defaultThreshold: 0, message: 'One or more Vercel projects have a failed deployment' },
    { id: 'deploy-failed', name: 'Deployment Failed', collectorId: 'latest_deployment', condition: 'status_is', defaultThreshold: 'ERROR', message: 'Latest deployment failed' },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.token
    const r = await fetchVercelMetrics(token)
    return [
      { collectorId: 'total_projects', value: r.totalProjects ?? null, valueText: null, unit: '', status: r.status },
      { collectorId: 'projects_failing', value: r.projectsFailing ?? null, valueText: null, unit: '', status: r.status },
      { collectorId: 'latest_deployment', value: null, valueText: r.latestDeploymentStatus ?? null, unit: '', status: r.status },
    ]
  },
}

export interface VercelMetricResult {
  totalProjects: number | null
  projectsFailing: number | null
  latestDeploymentStatus: string | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchVercelMetrics(token: string): Promise<VercelMetricResult> {
  const headers = { Authorization: `Bearer ${token}` }
  try {
    // Get user's default team
    const userRes = await fetch('https://api.vercel.com/v2/user', { headers })
    const userJson = userRes.ok ? await userRes.json() : null
    const defaultTeamId = userJson?.user?.defaultTeamId ?? null

    // If no defaultTeamId, fall back to first team from /v2/teams
    let teamId = defaultTeamId
    if (!teamId) {
      const teamsRes = await fetch('https://api.vercel.com/v2/teams', { headers })
      if (teamsRes.ok) {
        const teamsJson = await teamsRes.json()
        teamId = teamsJson?.teams?.[0]?.id ?? null
      }
    }

    const projectsUrl = teamId
      ? `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100`
      : 'https://api.vercel.com/v9/projects?limit=100'

    const projectsRes = await fetch(projectsUrl, { headers })

    if (!projectsRes.ok) {
      return { totalProjects: null, projectsFailing: null, latestDeploymentStatus: null, status: 'unknown', error: 'API error' }
    }

    const projectsJson = await projectsRes.json()
    const projects: Array<{ latestDeployments?: Array<{ readyState: string; createdAt: number }> }> =
      projectsJson.projects ?? []

    const totalProjects = projects.length

    let projectsFailing = 0
    let latestDeployment: { readyState: string; createdAt: number } | null = null

    for (const project of projects) {
      const dep = project.latestDeployments?.[0]
      if (!dep) continue
      if (dep.readyState === 'ERROR') projectsFailing++
      if (!latestDeployment || dep.createdAt > latestDeployment.createdAt) {
        latestDeployment = dep
      }
    }

    const latestDeploymentStatus = latestDeployment?.readyState ?? null

    let status: VercelMetricResult['status'] = 'healthy'
    if (projectsFailing >= 3) status = 'critical'
    else if (projectsFailing >= 1) status = 'warning'
    else if (totalProjects === 0) status = 'unknown'

    return { totalProjects, projectsFailing, latestDeploymentStatus, status }
  } catch {
    return { totalProjects: null, projectsFailing: null, latestDeploymentStatus: null, status: 'unknown', error: 'Network error' }
  }
}
