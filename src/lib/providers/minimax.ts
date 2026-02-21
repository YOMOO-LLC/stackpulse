import type { ServiceProvider } from './types'

export const minimaxProvider: ServiceProvider = {
  id: 'minimax',
  name: 'MiniMax',
  category: 'ai',
  icon: '/icons/minimax.svg',
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
      endpoint: '/v1/models',
      displayHint: 'status-badge',
      description: 'MiniMax API connection status',
    },
  ],
  alerts: [
    {
      id: 'minimax-disconnected',
      name: 'MiniMax Disconnected',
      collectorId: 'connection_status',
      condition: 'status_is',
      defaultThreshold: 'auth_failed',
      message: 'MiniMax API key is invalid or expired',
    },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchMinimaxMetrics(credentials.apiKey)
    return [{ collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status }]
  },
}

export interface MinimaxMetricResult {
  status: 'healthy' | 'critical' | 'unknown'
  value?: string
  error?: string
}

export async function fetchMinimaxMetrics(apiKey: string): Promise<MinimaxMetricResult> {
  try {
    const res = await fetch('https://api.minimax.io/v1/models', {
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
