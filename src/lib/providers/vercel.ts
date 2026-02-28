import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/vercel'

export const vercelProvider: ServiceProvider = {
  id: 'vercel',
  name: 'Vercel',
  category: 'hosting',
  icon: '/icons/vercel.svg',
  authType: 'api_key',
  credentials: [
    { key: 'token', label: 'API Token', type: 'password', required: true, placeholder: 'vercel_...' },
  ],
  keyGuide: {
    url: 'https://vercel.com/account/settings/tokens',
    steps: [
      'Go to vercel.com and sign in to your account.',
      'Navigate to Settings → Tokens.',
      'Click "Create" and set a name and scope.',
      'Copy the generated token — it starts with vercel_...',
    ],
  },
  collectors: [
    {
      id: 'deployments_24h',
      name: 'Deployments (24h)',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Number of deployments in the last 24 hours',
      displayHint: 'number',
    },
    {
      id: 'deploy_success_rate',
      name: 'Deploy Success Rate',
      metricType: 'count', unit: '%', refreshInterval: 300,
      description: 'Percentage of successful deployments in the last 24 hours',
      displayHint: 'progress',
      thresholds: { warning: 80, critical: 50, direction: 'below', max: 100 },
    },
    {
      id: 'serverless_invocations',
      name: 'Serverless Invocations',
      metricType: 'count', unit: 'req', refreshInterval: 300,
      description: 'Total serverless function requests this month',
      displayHint: 'number',
    },
    {
      id: 'project_count',
      name: 'Projects',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Total number of projects',
      displayHint: 'number',
    },
  ],
  mockFetchMetrics,
  alerts: [
    { id: 'deploy-failing', name: 'Deploy Failing', collectorId: 'deployments_24h', condition: 'gt', defaultThreshold: 0, message: 'One or more deployments have errors' },
    { id: 'low-success-rate', name: 'Low Success Rate', collectorId: 'deploy_success_rate', condition: 'lt', defaultThreshold: 80, message: 'Deploy success rate is below 80%' },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.token
    const r = await fetchVercelMetrics(token)
    return [
      { collectorId: 'deployments_24h', value: r.deployments24h ?? null, valueText: null, unit: '', status: r.status },
      { collectorId: 'deploy_success_rate', value: r.deploySuccessRate ?? null, valueText: null, unit: '%', status: r.status },
      { collectorId: 'serverless_invocations', value: r.serverlessInvocations ?? null, valueText: null, unit: 'req', status: r.status },
      { collectorId: 'project_count', value: r.projectCount ?? null, valueText: null, unit: '', status: r.status },
    ]
  },
}

export interface VercelMetricResult {
  deployments24h: number | null
  deployments24hBreakdown: { ready: number; building: number; error: number } | null
  deploySuccessRate: number | null
  serverlessInvocations: number | null
  projectCount: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

const UNKNOWN_RESULT: VercelMetricResult = {
  deployments24h: null,
  deployments24hBreakdown: null,
  deploySuccessRate: null,
  serverlessInvocations: null,
  projectCount: null,
  status: 'unknown',
}

export async function fetchVercelMetrics(token: string): Promise<VercelMetricResult> {
  const headers = { Authorization: `Bearer ${token}` }
  try {
    // 1. Get user's default team
    const userRes = await fetch('https://api.vercel.com/v2/user', { headers })
    if (!userRes.ok) return { ...UNKNOWN_RESULT, error: 'API error' }
    const userJson = await userRes.json()
    let teamId: string | null = userJson?.user?.defaultTeamId ?? null

    // 2. Fall back to /v2/teams if no defaultTeamId
    if (!teamId) {
      const teamsRes = await fetch('https://api.vercel.com/v2/teams', { headers })
      if (teamsRes.ok) {
        const teamsJson = await teamsRes.json()
        teamId = teamsJson?.teams?.[0]?.id ?? null
      }
    }

    const teamQuery = teamId ? `teamId=${teamId}&` : ''

    // 3. GET /v9/projects → project count
    const projectsRes = await fetch(
      `https://api.vercel.com/v9/projects?${teamQuery}limit=100`,
      { headers },
    )
    if (!projectsRes.ok) return { ...UNKNOWN_RESULT, error: 'API error' }
    const projectsJson = await projectsRes.json()
    const projects: Array<Record<string, unknown>> = projectsJson.projects ?? []
    const projectCount = projects.length

    // 4. GET /v6/deployments?since=24h ago → count by readyState + success rate
    const since = Date.now() - 24 * 60 * 60 * 1000
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?${teamQuery}limit=100&since=${since}`,
      { headers },
    )
    if (!deploymentsRes.ok) return { ...UNKNOWN_RESULT, error: 'API error' }
    const deploymentsJson = await deploymentsRes.json()
    const deployments: Array<{ readyState: string }> = deploymentsJson.deployments ?? []

    const breakdown = { ready: 0, building: 0, error: 0 }
    for (const d of deployments) {
      if (d.readyState === 'READY') breakdown.ready++
      else if (d.readyState === 'BUILDING') breakdown.building++
      else if (d.readyState === 'ERROR') breakdown.error++
    }

    const deploySuccessRate = deployments.length === 0
      ? 100
      : Math.round((breakdown.ready / deployments.length) * 100)

    // 5. GET /v2/usage → serverless invocations this billing period (non-fatal)
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const fromISO = monthStart.toISOString()
    const toISO = now.toISOString()

    let serverlessInvocations: number | null = null
    try {
      const usageRes = await fetch(
        `https://api.vercel.com/v2/usage?${teamQuery}type=edge&from=${fromISO}&to=${toISO}`,
        { headers },
      )
      if (usageRes.ok) {
        const usageJson = await usageRes.json()
        const days: Array<{ worker_invocation_count?: number }> = usageJson.data ?? []
        serverlessInvocations = days.reduce((sum, d) => sum + (d.worker_invocation_count ?? 0), 0)
      }
    } catch { /* non-fatal */ }

    // Determine status
    let status: VercelMetricResult['status'] = 'healthy'
    if (breakdown.error >= 3) {
      status = 'critical'
    } else if (breakdown.error >= 1) {
      status = 'warning'
    }

    return {
      deployments24h: deployments.length,
      deployments24hBreakdown: breakdown,
      deploySuccessRate,
      serverlessInvocations,
      projectCount,
      status,
    }
  } catch {
    return { ...UNKNOWN_RESULT, error: 'Network error' }
  }
}
