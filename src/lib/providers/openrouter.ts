import type { ServiceProvider } from './types'

export const openrouterProvider: ServiceProvider = {
  id: 'openrouter',
  name: 'OpenRouter',
  category: 'ai',
  icon: '/icons/openrouter.svg',
  authType: 'api_key',
  credentials: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  collectors: [
    {
      id: 'credit_balance',
      name: 'Credit Balance',
      metricType: 'currency',
      unit: 'USD',
      refreshInterval: 300,
      endpoint: '/api/v1/auth/key',
      displayHint: 'currency',
      thresholds: { warning: 2, critical: 0.5, direction: 'below' },
      description: 'Remaining OpenRouter API credits',
      trend: true,
    },
  ],
  alerts: [
    {
      id: 'low-credits',
      name: 'Low Credits',
      collectorId: 'credit_balance',
      condition: 'lt',
      defaultThreshold: 10,
      message: 'OpenRouter credits below ${threshold}',
    },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchOpenRouterMetrics(credentials.apiKey)
    return [{ collectorId: 'credit_balance', value: r.value ?? null, valueText: null, unit: 'USD', status: r.status }]
  },
}

export interface MetricResult {
  status: 'healthy' | 'warning' | 'unknown'
  value?: number
  error?: string
}

export async function fetchOpenRouterMetrics(apiKey: string): Promise<MetricResult> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      return { status: 'unknown', error: `HTTP ${res.status}` }
    }

    const json = await res.json()
    const remaining = (json.data.total_credits as number) - (json.data.total_usage as number)

    return {
      status: remaining < 5 ? 'warning' : 'healthy',
      value: Math.round(remaining * 100) / 100,
    }
  } catch {
    return { status: 'unknown', error: 'Network error' }
  }
}
