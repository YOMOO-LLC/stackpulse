import type { ServiceProvider } from './types'

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
  ],
  alerts: [
    {
      id: 'supabase-disconnected',
      name: 'Supabase Disconnected',
      collectorId: 'connection_status',
      condition: 'status_is',
      defaultThreshold: 'auth_failed',
      message: 'Supabase OAuth token is invalid or expired',
    },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.serviceRoleKey ?? ''
    const r = await fetchSupabaseMetrics(token)
    return [{ collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status }]
  },
}

export interface SupabaseMetricResult {
  status: 'healthy' | 'critical' | 'unknown'
  value?: string
  error?: string
}

export async function fetchSupabaseMetrics(accessToken: string): Promise<SupabaseMetricResult> {
  try {
    const res = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (res.status === 401 || res.status === 403) {
      return { status: 'critical', value: 'auth_failed' }
    }

    if (!res.ok) {
      return { status: 'unknown', error: `HTTP ${res.status}` }
    }

    return { status: 'healthy', value: 'connected' }
  } catch {
    return { status: 'unknown', error: 'Network error' }
  }
}
