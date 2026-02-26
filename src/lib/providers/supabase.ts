import type { ServiceProvider, ProjectOption } from './types'
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
  keyGuide: {
    url: 'https://supabase.com/dashboard/account/tokens',
    steps: [
      'Go to supabase.com/dashboard and sign in.',
      'Click your avatar (bottom left) → Account Preferences.',
      'Navigate to Access Tokens.',
      'Click "Generate new token", give it a name.',
      'Copy the token — it starts with sbp_...',
    ],
  },
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
      section: 'header',
    },
    {
      id: 'db_requests_24h',
      name: 'Database Requests (24h)',
      metricType: 'count',
      unit: 'req',
      refreshInterval: 300,
      description: 'Database (REST) requests in the last 24 hours',
      trend: true,
    },
    {
      id: 'auth_requests_24h',
      name: 'Auth Requests (24h)',
      metricType: 'count',
      unit: 'req',
      refreshInterval: 300,
      description: 'Auth requests in the last 24 hours',
      trend: true,
    },
    {
      id: 'storage_requests_24h',
      name: 'Storage Requests (24h)',
      metricType: 'count',
      unit: 'req',
      refreshInterval: 300,
      description: 'Storage requests in the last 24 hours',
      trend: true,
    },
    {
      id: 'realtime_requests_24h',
      name: 'Realtime Requests (24h)',
      metricType: 'count',
      unit: 'req',
      refreshInterval: 300,
      description: 'Realtime requests in the last 24 hours',
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
      id: 'disk_usage_bytes',
      name: 'Disk Usage',
      metricType: 'count',
      unit: 'bytes',
      refreshInterval: 600,
      description: 'Database disk usage in bytes',
    },
    {
      id: 'edge_function_count',
      name: 'Edge Functions',
      metricType: 'count',
      unit: 'functions',
      refreshInterval: 600,
      description: 'Number of deployed edge functions',
    },
    {
      id: 'db_health',
      name: 'Database',
      metricType: 'status',
      unit: '',
      refreshInterval: 300,
      displayHint: 'status-badge',
      description: 'Database service health',
      section: 'health',
    },
    {
      id: 'auth_health',
      name: 'Auth',
      metricType: 'status',
      unit: '',
      refreshInterval: 300,
      displayHint: 'status-badge',
      description: 'Auth service health',
      section: 'health',
    },
    {
      id: 'realtime_health',
      name: 'Realtime',
      metricType: 'status',
      unit: '',
      refreshInterval: 300,
      displayHint: 'status-badge',
      description: 'Realtime service health',
      section: 'health',
    },
    {
      id: 'storage_health',
      name: 'Storage',
      metricType: 'status',
      unit: '',
      refreshInterval: 300,
      displayHint: 'status-badge',
      description: 'Storage service health',
      section: 'health',
    },
  ],
  mockFetchMetrics,
  projectSelector: {
    key: 'project_ref',
    label: 'Select Project',
    fetch: async (credentials) => {
      const token = credentials.token ?? credentials.access_token ?? ''
      return fetchSupabaseProjects(token)
    },
  },
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
    {
      id: 'supabase-storage-unhealthy',
      name: 'Storage Service Down',
      collectorId: 'storage_health',
      condition: 'status_is',
      defaultThreshold: 'COMING_UP',
      message: 'Storage service is not in ACTIVE_HEALTHY state',
    },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.token ?? credentials.access_token ?? ''
    const r = await fetchSupabaseMetrics(token, credentials.project_ref)
    const base = r.status === 'critical' ? 'critical' : 'healthy'

    function healthStatus(val: string | null): string {
      if (!val) return 'unknown'
      return val === 'ACTIVE_HEALTHY' ? 'healthy' : 'warning'
    }

    return [
      { collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status },
      { collectorId: 'db_requests_24h', value: r.dbRequests24h ?? null, valueText: null, unit: 'req', status: base },
      { collectorId: 'auth_requests_24h', value: r.authRequests24h ?? null, valueText: null, unit: 'req', status: base },
      { collectorId: 'storage_requests_24h', value: r.storageRequests24h ?? null, valueText: null, unit: 'req', status: base },
      { collectorId: 'realtime_requests_24h', value: r.realtimeRequests24h ?? null, valueText: null, unit: 'req', status: base },
      { collectorId: 'active_db_connections', value: r.activeDbConnections ?? null, valueText: null, unit: '', status: base },
      { collectorId: 'disk_usage_bytes', value: r.diskUsageBytes ?? null, valueText: null, unit: 'bytes', status: base },
      { collectorId: 'edge_function_count', value: r.edgeFunctionCount ?? null, valueText: null, unit: 'functions', status: base },
      { collectorId: 'db_health', value: null, valueText: r.dbHealth ?? null, unit: '', status: healthStatus(r.dbHealth) },
      { collectorId: 'auth_health', value: null, valueText: r.authHealth ?? null, unit: '', status: healthStatus(r.authHealth) },
      { collectorId: 'realtime_health', value: null, valueText: r.realtimeHealth ?? null, unit: '', status: healthStatus(r.realtimeHealth) },
      { collectorId: 'storage_health', value: null, valueText: r.storageHealth ?? null, unit: '', status: healthStatus(r.storageHealth) },
    ]
  },
}

export interface SupabaseMetricResult {
  status: 'healthy' | 'critical' | 'unknown'
  value?: string
  dbRequests24h: number | null
  authRequests24h: number | null
  storageRequests24h: number | null
  realtimeRequests24h: number | null
  activeDbConnections: number | null
  diskUsageBytes: number | null
  edgeFunctionCount: number | null
  dbHealth: string | null
  authHealth: string | null
  realtimeHealth: string | null
  storageHealth: string | null
  projectRef?: string
  error?: string
}

const NULL_RESULT: SupabaseMetricResult = {
  status: 'unknown',
  dbRequests24h: null,
  authRequests24h: null,
  storageRequests24h: null,
  realtimeRequests24h: null,
  activeDbConnections: null,
  diskUsageBytes: null,
  edgeFunctionCount: null,
  dbHealth: null,
  authHealth: null,
  realtimeHealth: null,
  storageHealth: null,
}

export async function fetchSupabaseProjects(accessToken: string): Promise<ProjectOption[]> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const res = await fetch('https://api.supabase.com/v1/projects', { headers })
  if (!res.ok) return []
  const projects: { id: string; name: string; status: string }[] = await res.json()
  return projects.map((p) => ({ value: p.id, label: p.name }))
}

export async function fetchSupabaseMetrics(accessToken: string, projectRef?: string): Promise<SupabaseMetricResult> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  try {
    // 1. Connection check + resolve project ref
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', { headers })

    if (projectsRes.status === 401 || projectsRes.status === 403) {
      return { ...NULL_RESULT, value: 'auth_failed', status: 'critical' }
    }
    if (!projectsRes.ok) {
      return { ...NULL_RESULT, error: `HTTP ${projectsRes.status}` }
    }

    const projects: { id: string; name: string; status: string }[] = await projectsRes.json()

    // Use provided projectRef, otherwise fall back to first project
    const matchedProject = projectRef
      ? projects.find((p) => p.id === projectRef)
      : projects[0]

    if (!matchedProject) {
      return { ...NULL_RESULT, value: 'connected', status: 'healthy' }
    }

    const ref = matchedProject.id

    // 2. Edge functions
    let edgeFunctionCount: number | null = null
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, { headers })
      if (res.ok) {
        const fns = await res.json()
        edgeFunctionCount = Array.isArray(fns) ? fns.length : null
      }
    } catch { /* leave null */ }

    // 3. API request counts by service (24h)
    let dbRequests24h: number | null = null
    let authRequests24h: number | null = null
    let storageRequests24h: number | null = null
    let realtimeRequests24h: number | null = null
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/usage.api-counts?interval=1day`,
        { headers },
      )
      if (res.ok) {
        type ApiCountRow = { total_rest_requests?: number; total_auth_requests?: number; total_storage_requests?: number; total_realtime_requests?: number }
        const data = await res.json()
        // Handle both bare array and { result: [...] } wrapper
        const rows: ApiCountRow[] = Array.isArray(data) ? data : (Array.isArray(data?.result) ? data.result : [])
        let dbReq = 0, authReq = 0, storageReq = 0, realtimeReq = 0
        for (const row of rows) {
          dbReq += row.total_rest_requests ?? 0
          authReq += row.total_auth_requests ?? 0
          storageReq += row.total_storage_requests ?? 0
          realtimeReq += row.total_realtime_requests ?? 0
        }
        dbRequests24h = dbReq
        authRequests24h = authReq
        storageRequests24h = storageReq
        realtimeRequests24h = realtimeReq
      }
    } catch { /* leave null */ }

    // 4. Combined DB query: connections + disk size
    let activeDbConnections: number | null = null
    let diskUsageBytes: number | null = null
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `SELECT (SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL) as conn_count, pg_database_size(current_database()) as db_size_bytes`,
        }),
      })
      if (res.ok) {
        const rows = await res.json()
        const row = rows?.[0]
        if (row) {
          const cc = row.conn_count
          activeDbConnections = typeof cc === 'number' ? cc : (typeof cc === 'string' ? parseInt(cc, 10) : null)
          const ds = row.db_size_bytes
          diskUsageBytes = typeof ds === 'number' ? ds : (typeof ds === 'string' ? parseInt(ds, 10) : null)
        }
      }
    } catch { /* leave null */ }

    // 5. Service health
    let dbHealth: string | null = null
    let authHealth: string | null = null
    let realtimeHealth: string | null = null
    let storageHealth: string | null = null
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${ref}/health?services=db&services=auth&services=realtime&services=storage`,
        { headers },
      )
      if (res.ok) {
        const services: { name: string; healthy: boolean; status: string }[] = await res.json()
        for (const svc of services) {
          switch (svc.name) {
            case 'db': dbHealth = svc.status; break
            case 'auth': authHealth = svc.status; break
            case 'realtime': realtimeHealth = svc.status; break
            case 'storage': storageHealth = svc.status; break
          }
        }
      }
    } catch { /* leave null */ }

    return {
      value: 'connected',
      status: 'healthy',
      dbRequests24h,
      authRequests24h,
      storageRequests24h,
      realtimeRequests24h,
      activeDbConnections,
      diskUsageBytes,
      edgeFunctionCount,
      dbHealth,
      authHealth,
      realtimeHealth,
      storageHealth,
      projectRef: ref,
    }
  } catch {
    return { ...NULL_RESULT, error: 'Network error' }
  }
}
