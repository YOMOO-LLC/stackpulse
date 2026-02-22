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
      id: 'deployments_24h',
      name: 'Deployments (24h)',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Number of deployments in the last 24 hours',
      displayHint: 'number',
    },
    {
      id: 'bandwidth_used',
      name: 'Bandwidth Used',
      metricType: 'count', unit: 'GB', refreshInterval: 300,
      description: 'Edge bandwidth used this billing period',
      displayHint: 'progress',
      thresholds: { warning: 70, critical: 90, direction: 'above', max: 100 },
    },
    {
      id: 'serverless_invocations',
      name: 'Serverless Invocations',
      metricType: 'count', unit: 'req', refreshInterval: 300,
      description: 'Total serverless function requests this month',
      displayHint: 'number',
    },
    {
      id: 'active_domains',
      name: 'Active Domains',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Unique custom domains across all projects',
      displayHint: 'number',
    },
  ],
  alerts: [
    { id: 'deploy-failing', name: 'Deploy Failing', collectorId: 'deployments_24h', condition: 'gt', defaultThreshold: 0, message: 'One or more deployments have errors' },
    { id: 'high-bandwidth', name: 'High Bandwidth', collectorId: 'bandwidth_used', condition: 'gt', defaultThreshold: 80, message: 'Bandwidth usage is above 80 GB' },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.token
    const r = await fetchVercelMetrics(token)
    return [
      { collectorId: 'deployments_24h', value: r.deployments24h ?? null, valueText: null, unit: '', status: r.status },
      { collectorId: 'bandwidth_used', value: r.bandwidthUsed ?? null, valueText: null, unit: 'GB', status: r.status },
      { collectorId: 'serverless_invocations', value: r.serverlessInvocations ?? null, valueText: null, unit: 'req', status: r.status },
      { collectorId: 'active_domains', value: r.activeDomains ?? null, valueText: null, unit: '', status: r.status },
    ]
  },
}

export interface VercelMetricResult {
  deployments24h: number | null
  deployments24hBreakdown: { ready: number; building: number; error: number } | null
  bandwidthUsed: number | null
  serverlessInvocations: number | null
  activeDomains: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

const UNKNOWN_RESULT: VercelMetricResult = {
  deployments24h: null,
  deployments24hBreakdown: null,
  bandwidthUsed: null,
  serverlessInvocations: null,
  activeDomains: null,
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

    // 3. GET /v9/projects → active domains (non-.vercel.app aliases)
    const projectsRes = await fetch(
      `https://api.vercel.com/v9/projects?${teamQuery}limit=100`,
      { headers },
    )
    if (!projectsRes.ok) return { ...UNKNOWN_RESULT, error: 'API error' }
    const projectsJson = await projectsRes.json()
    const projects: Array<{ alias?: string[] }> = projectsJson.projects ?? []

    const allAliases = projects.flatMap(p => p.alias ?? [])
    const customDomains = allAliases.filter(a => !a.endsWith('.vercel.app'))
    const activeDomains = new Set(customDomains).size

    // 4. GET /v9/deployments?since=24h ago → count by readyState
    const since = Date.now() - 24 * 60 * 60 * 1000
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v9/deployments?${teamQuery}limit=100&since=${since}`,
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

    // 5. GET /v2/usage?type=edge → bandwidth GB
    const usageRes = await fetch(
      `https://api.vercel.com/v2/usage?type=edge`,
      { headers },
    )
    const bandwidthUsed = usageRes.ok
      ? (await usageRes.json())?.edgeUsage?.gb ?? null
      : null

    // 6. GET /v2/usage?type=requests → serverless invocations
    const requestsRes = await fetch(
      `https://api.vercel.com/v2/usage?type=requests`,
      { headers },
    )
    const serverlessInvocations = requestsRes.ok
      ? (await requestsRes.json())?.requestsUsage?.total ?? null
      : null

    // Determine status
    let status: VercelMetricResult['status'] = 'healthy'
    if (breakdown.error >= 3 || (bandwidthUsed !== null && bandwidthUsed > 90)) {
      status = 'critical'
    } else if (breakdown.error >= 1 || (bandwidthUsed !== null && bandwidthUsed > 70)) {
      status = 'warning'
    }

    return {
      deployments24h: deployments.length,
      deployments24hBreakdown: breakdown,
      bandwidthUsed,
      serverlessInvocations,
      activeDomains,
      status,
    }
  } catch {
    return { ...UNKNOWN_RESULT, error: 'Network error' }
  }
}
