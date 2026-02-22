import type { ServiceProvider } from './types'

export interface OpenRouterMetricResult {
  creditBalance: number | null
  monthlySpend: number | null
  requests24h: number | null
  modelsUsed: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchOpenRouterMetrics(apiKey: string): Promise<OpenRouterMetricResult> {
  const headers = { Authorization: `Bearer ${apiKey}` }
  try {
    const creditsRes = await fetch('https://openrouter.ai/api/v1/credits', { headers })
    if (!creditsRes.ok) {
      return { creditBalance: null, monthlySpend: null, requests24h: null, modelsUsed: null, status: 'unknown', error: `HTTP ${creditsRes.status}` }
    }

    const json = await creditsRes.json()
    const totalCredits = json.data.total_credits as number
    const totalUsage = json.data.total_usage as number
    const creditBalance = Math.round((totalCredits - totalUsage) * 100) / 100
    const monthlySpend = Math.round(totalUsage * 100) / 100

    let requests24h: number | null = null
    let modelsUsed: number | null = null
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const genRes = await fetch(`https://openrouter.ai/api/v1/generation?date_min=${since}&limit=1000`, { headers })
      if (genRes.ok) {
        const genJson = await genRes.json()
        const generations = genJson.data ?? []
        requests24h = generations.length
        const models = new Set<string>(generations.map((g: { model: string }) => g.model))
        modelsUsed = models.size
      }
    } catch { /* non-fatal */ }

    const status = creditBalance < 2 ? 'warning' : 'healthy'
    return { creditBalance, monthlySpend, requests24h, modelsUsed, status }
  } catch {
    return { creditBalance: null, monthlySpend: null, requests24h: null, modelsUsed: null, status: 'unknown', error: 'Network error' }
  }
}

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
      endpoint: '/api/v1/credits',
      displayHint: 'currency',
      thresholds: { warning: 2, critical: 0.5, direction: 'below' },
      description: 'Remaining OpenRouter API credits',
      trend: true,
    },
    {
      id: 'monthly_spend',
      name: 'Monthly Spend',
      metricType: 'currency',
      unit: 'USD',
      refreshInterval: 300,
      displayHint: 'currency',
      description: 'Total spend in current billing period',
      trend: true,
    },
    {
      id: 'requests_24h',
      name: 'Requests (24h)',
      metricType: 'count',
      unit: 'requests',
      refreshInterval: 300,
      description: 'API requests in the last 24 hours',
      trend: true,
    },
    {
      id: 'models_used',
      name: 'Models Used',
      metricType: 'count',
      unit: 'models',
      refreshInterval: 300,
      description: 'Distinct models used this month',
    },
  ],
  alerts: [
    {
      id: 'low-credits',
      name: 'Low Credits',
      collectorId: 'credit_balance',
      condition: 'lt',
      defaultThreshold: 2,
      message: 'OpenRouter credits are running low',
    },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchOpenRouterMetrics(credentials.apiKey)
    return [
      { collectorId: 'credit_balance', value: r.creditBalance ?? null, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'monthly_spend', value: r.monthlySpend ?? null, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'requests_24h', value: r.requests24h ?? null, valueText: null, unit: 'requests', status: r.status },
      { collectorId: 'models_used', value: r.modelsUsed ?? null, valueText: null, unit: 'models', status: r.status },
    ]
  },
}
