import type { ServiceProvider } from './types'

export interface MinimaxMetricResult {
  connectionStatus: string | null
  responseLatencyMs: number | null
  apiCalls24h: number | null
  uptime: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchMinimaxMetrics(apiKey: string): Promise<MinimaxMetricResult> {
  const startTime = Date.now()
  try {
    const res = await fetch('https://api.minimax.io/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const responseLatencyMs = Date.now() - startTime

    if (res.status === 401) {
      return {
        connectionStatus: 'auth_failed',
        responseLatencyMs: null,
        apiCalls24h: null,
        uptime: null,
        status: 'unknown',
        error: 'Auth failed',
      }
    }

    if (!res.ok) {
      return {
        connectionStatus: null,
        responseLatencyMs: null,
        apiCalls24h: null,
        uptime: null,
        status: 'unknown',
        error: `HTTP ${res.status}`,
      }
    }

    let status: MinimaxMetricResult['status'] = 'healthy'
    if (responseLatencyMs > 3000) status = 'critical'
    else if (responseLatencyMs > 1000) status = 'warning'

    return {
      connectionStatus: 'connected',
      responseLatencyMs,
      apiCalls24h: null,
      uptime: null,
      status,
    }
  } catch {
    return {
      connectionStatus: null,
      responseLatencyMs: null,
      apiCalls24h: null,
      uptime: null,
      status: 'unknown',
      error: 'Network error',
    }
  }
}

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
      displayHint: 'status-badge',
      description: 'MiniMax API connection status',
    },
    {
      id: 'response_latency',
      name: 'Response Latency',
      metricType: 'count',
      unit: 'ms',
      refreshInterval: 300,
      thresholds: { warning: 1000, critical: 3000, direction: 'above' },
      description: 'API response time in ms',
      displayHint: 'number',
    },
    {
      id: 'api_calls_24h',
      name: 'API Calls (24h)',
      metricType: 'count',
      unit: 'calls',
      refreshInterval: 300,
      description: 'Monitoring pings in last 24h',
      displayHint: 'number',
    },
    {
      id: 'uptime',
      name: 'Uptime',
      metricType: 'percentage',
      unit: '%',
      refreshInterval: 300,
      description: 'API uptime over last 30 days',
      displayHint: 'number',
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
    return [
      { collectorId: 'connection_status', value: null, valueText: r.connectionStatus ?? null, unit: '', status: r.status },
      { collectorId: 'response_latency', value: r.responseLatencyMs ?? null, valueText: null, unit: 'ms', status: r.status },
      { collectorId: 'api_calls_24h', value: r.apiCalls24h ?? null, valueText: null, unit: 'calls', status: r.status },
      { collectorId: 'uptime', value: r.uptime ?? null, valueText: null, unit: '%', status: r.status },
    ]
  },
}
