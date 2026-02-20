import type { ServiceProvider } from './types'

export const resendProvider: ServiceProvider = {
  id: 'resend',
  name: 'Resend',
  category: 'email',
  icon: '/icons/resend.svg',
  authType: 'api_key',
  credentials: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  collectors: [
    {
      id: 'connection_status',
      name: 'Connection Status',
      metricType: 'status',
      unit: '',
      refreshInterval: 300,
      endpoint: '/domains',
      displayHint: 'status-badge',
      description: 'Resend API connection status',
    },
  ],
  alerts: [
    {
      id: 'resend-disconnected',
      name: 'Resend Disconnected',
      collectorId: 'connection_status',
      condition: 'status_is',
      defaultThreshold: 'auth_failed',
      message: 'Resend API key is invalid or expired',
    },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchResendMetrics(credentials.apiKey)
    return [{ collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status }]
  },
}

export interface ResendMetricResult {
  status: 'healthy' | 'critical' | 'unknown'
  value?: string
  error?: string
}

export async function fetchResendMetrics(apiKey: string): Promise<ResendMetricResult> {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (res.status === 401) {
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
