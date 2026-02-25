import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/supabase'

export const supabaseProvider: ServiceProvider = {
  id: 'supabase',
  name: 'Supabase',
  category: 'infrastructure',
  icon: '/icons/supabase.svg',
  authType: 'api_key',
  credentials: [
    { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'sbp_...' },
  ],
  collectors: [
    {
      id: 'connection_status',
      name: 'Connection Status',
      metricType: 'status',
      unit: '',
      refreshInterval: 300,
      endpoint: '/v1/projects',
      displayHint: 'status-badge',
      description: 'Supabase account connection status',
    },
    {
      id: 'api_requests_24h',
      name: 'API Requests (24h)',
      metricType: 'count',
      unit: 'req',
      refreshInterval: 300,
      description: 'Total API requests in the last 24 hours',
      trend: true,
    },
    {
      id: 'active_db_connections',
      name: 'Active DB Connections',
      metricType: 'count',
      unit: '',
      refreshInterval: 300,
      description: 'Current active database connections',
      thresholds: { warning: 40, critical: 55, direction: 'above' },
    },
    {
      id: 'edge_function_count',
      name: 'Edge Functions',
      metricType: 'count',
      unit: 'functions',
      refreshInterval: 600,
      description: 'Number of deployed edge functions',
    },
  ],
  mockFetchMetrics,
  alerts: [
    {
      id: 'supabase-disconnected',
      name: 'Supabase Disconnected',
      collectorId: 'connection_status',
      condition: 'status_is',
      defaultThreshold: 'auth_failed',
      message: 'Supabase access token is invalid or expired',
    },
    {
      id: 'supabase-db-connections-high',
      name: 'DB Connections High',
      collectorId: 'active_db_connections',
      condition: 'gt',
      defaultThreshold: 50,
      message: 'Active database connections exceeding threshold',
    },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.token ?? credentials.access_token ?? ''
    const r = await fetchSupabaseMetrics(token)
    return [
      { collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status },
      { collectorId: 'api_requests_24h', value: r.apiRequests24h ?? null, valueText: null, unit: 'req', status: r.status === 'critical' ? 'critical' : 'healthy' },
      { collectorId: 'active_db_connections', value: r.activeDbConnections ?? null, valueText: null, unit: '', status: r.status === 'critical' ? 'critical' : 'healthy' },
      { collectorId: 'edge_function_count', value: r.edgeFunctionCount ?? null, valueText: null, unit: 'functions', status: r.status === 'critical' ? 'critical' : 'healthy' },
    ]
  },
}

export interface SupabaseMetricResult {
  status: 'healthy' | 'critical' | 'unknown'
  value?: string
  apiRequests24h: number | null
  activeDbConnections: number | null
  edgeFunctionCount: number | null
  projectRef?: string
  error?: string
}

export async function fetchSupabaseMetrics(accessToken: string): Promise<SupabaseMetricResult> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const nullResult: SupabaseMetricResult = {
    status: 'unknown',
    apiRequests24h: null,
    activeDbConnections: null,
    edgeFunctionCount: null,
  }

  try {
    // 1. Connection check + get first project ref
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', { headers })

    if (projectsRes.status === 401 || projectsRes.status === 403) {
      return { ...nullResult, value: 'auth_failed', status: 'critical' }
    }
    if (!projectsRes.ok) {
      return { ...nullResult, error: `HTTP ${projectsRes.status}` }
    }

    const projects: { id: string; name: string; status: string }[] = await projectsRes.json()
    const firstProject = projects[0]

    if (!firstProject) {
      return {
        value: 'connected',
        status: 'healthy',
        apiRequests24h: null,
        activeDbConnections: null,
        edgeFunctionCount: null,
      }
    }

    const ref = firstProject.id

    // 2. Edge functions count
    let edgeFunctionCount: number | null = null
    try {
      const functionsRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, { headers })
      if (functionsRes.ok) {
        const fns = await functionsRes.json()
        edgeFunctionCount = Array.isArray(fns) ? fns.length : null
      }
    } catch {
      // leave null
    }

    // 3. API requests (24h)
    let apiRequests24h: number | null = null
    try {
      const analyticsRes = await fetch(
        `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/usage.api-requests-count`,
        { headers },
      )
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        const count = data?.result?.[0]?.count
        apiRequests24h = typeof count === 'number' ? count : null
      }
    } catch {
      // leave null
    }

    // 4. Active DB connections
    let activeDbConnections: number | null = null
    try {
      const dbRes = await fetch(
        `https://api.supabase.com/v1/projects/${ref}/database/query`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL',
          }),
        },
      )
      if (dbRes.ok) {
        const rows = await dbRes.json()
        const count = rows?.[0]?.count
        activeDbConnections = typeof count === 'number' ? count : (typeof count === 'string' ? parseInt(count, 10) : null)
      }
    } catch {
      // leave null
    }

    return {
      value: 'connected',
      status: 'healthy',
      apiRequests24h,
      activeDbConnections,
      edgeFunctionCount,
      projectRef: ref,
    }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}
