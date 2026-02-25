import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/supabase'

export const supabaseProvider: ServiceProvider = {
  id: 'supabase',
  name: 'Supabase',
  category: 'infrastructure',
  icon: '/icons/supabase.svg',
  authType: 'oauth2',
  credentials: [],
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
      id: 'project_count',
      name: 'Projects',
      metricType: 'count',
      unit: 'projects',
      refreshInterval: 600,
      description: 'Total number of Supabase projects in your account',
    },
    {
      id: 'active_project_count',
      name: 'Active Projects',
      metricType: 'count',
      unit: 'projects',
      refreshInterval: 300,
      description: 'Projects with ACTIVE_HEALTHY status',
      thresholds: { warning: 0, critical: 0, direction: 'below' },
    },
    {
      id: 'edge_function_count',
      name: 'Edge Functions',
      metricType: 'count',
      unit: 'functions',
      refreshInterval: 600,
      description: 'Number of deployed edge functions (requires edge_functions:read scope)',
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
      message: 'Supabase OAuth token is invalid or expired',
    },
    {
      id: 'supabase-project-unhealthy',
      name: 'Project Unhealthy',
      collectorId: 'active_project_count',
      condition: 'lt',
      defaultThreshold: 1,
      message: 'One or more Supabase projects are not in ACTIVE_HEALTHY state',
    },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.serviceRoleKey ?? ''
    const r = await fetchSupabaseMetrics(token)
    return [
      { collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status },
      { collectorId: 'project_count', value: r.projectCount ?? null, valueText: null, unit: 'projects', status: r.status === 'critical' ? 'critical' : 'healthy' },
      { collectorId: 'active_project_count', value: r.activeProjectCount ?? null, valueText: null, unit: 'projects', status: r.status === 'critical' ? 'critical' : 'healthy' },
      { collectorId: 'edge_function_count', value: r.edgeFunctionCount ?? null, valueText: null, unit: 'functions', status: r.status === 'critical' ? 'critical' : 'healthy' },
    ]
  },
}

export interface SupabaseMetricResult {
  status: 'healthy' | 'critical' | 'unknown'
  value?: string
  projectCount: number | null
  activeProjectCount: number | null
  edgeFunctionCount: number | null
  projectRef?: string
  error?: string
}

export async function fetchSupabaseMetrics(accessToken: string): Promise<SupabaseMetricResult> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const nullResult: SupabaseMetricResult = {
    status: 'unknown',
    projectCount: null,
    activeProjectCount: null,
    edgeFunctionCount: null,
  }

  try {
    // 1. Connection check + get project list
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', { headers })

    if (projectsRes.status === 401 || projectsRes.status === 403) {
      return { ...nullResult, value: 'auth_failed', status: 'critical' }
    }
    if (!projectsRes.ok) {
      return { ...nullResult, error: `HTTP ${projectsRes.status}` }
    }

    const projects: { id: string; name: string; status: string }[] = await projectsRes.json()
    const projectCount = projects.length
    const activeProjectCount = projects.filter(p => p.status === 'ACTIVE_HEALTHY').length
    const firstProject = projects[0]

    if (!firstProject) {
      return {
        value: 'connected',
        status: 'healthy',
        projectCount: 0,
        activeProjectCount: 0,
        edgeFunctionCount: null,
      }
    }

    const ref = firstProject.id

    // 2. Edge functions count (requires edge_functions:read scope)
    let edgeFunctionCount: number | null = null
    try {
      const functionsRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, { headers })
      if (functionsRes.ok) {
        const fns = await functionsRes.json()
        edgeFunctionCount = Array.isArray(fns) ? fns.length : null
      }
    } catch {
      // scope not granted — leave null
    }

    return {
      value: 'connected',
      status: 'healthy',
      projectCount,
      activeProjectCount,
      edgeFunctionCount,
      projectRef: ref,
    }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}
