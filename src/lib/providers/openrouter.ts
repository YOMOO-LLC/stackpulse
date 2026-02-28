import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/openrouter'

export interface OpenRouterMetricResult {
  creditBalance: number | null
  monthlySpend: number | null
  requests24h: number | null
  modelsUsed: number | null
  totalTokens: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchOpenRouterMetrics(apiKey: string): Promise<OpenRouterMetricResult> {
  const headers = { Authorization: `Bearer ${apiKey}` }
  try {
    const creditsRes = await fetch('https://openrouter.ai/api/v1/credits', { headers })
    if (!creditsRes.ok) {
      return { creditBalance: null, monthlySpend: null, requests24h: null, modelsUsed: null, totalTokens: null, status: 'unknown', error: `HTTP ${creditsRes.status}` }
    }

    const json = await creditsRes.json()
    const totalCredits = json.data.total_credits as number
    const totalUsage = json.data.total_usage as number
    const creditBalance = Math.round((totalCredits - totalUsage) * 100) / 100
    const monthlySpend = Math.round(totalUsage * 100) / 100

    let requests24h: number | null = null
    let modelsUsed: number | null = null
    let totalTokens: number | null = null
    try {
      const activityRes = await fetch('https://openrouter.ai/api/v1/activity', { headers })
      if (activityRes.ok) {
        const activityJson = await activityRes.json()
        const items: { date: string; model: string; requests: number; prompt_tokens?: number; completion_tokens?: number; reasoning_tokens?: number }[] = activityJson.data ?? []

        // requests_24h: sum requests for today + yesterday (UTC) to approximate 24h window
        // Note: activity API returns dates as "YYYY-MM-DD 00:00:00", so compare first 10 chars
        const now = new Date()
        const todayUTC = now.toISOString().slice(0, 10)
        const yd = new Date(now)
        yd.setUTCDate(yd.getUTCDate() - 1)
        const yesterdayUTC = yd.toISOString().slice(0, 10)
        requests24h = 0
        totalTokens = 0
        for (const item of items) {
          const itemDate = item.date.slice(0, 10)
          if (itemDate === todayUTC || itemDate === yesterdayUTC) {
            requests24h += item.requests ?? 0
          }
          totalTokens += (item.prompt_tokens ?? 0) + (item.completion_tokens ?? 0) + (item.reasoning_tokens ?? 0)
        }

        // models_used: distinct models across all returned data (last 30 days)
        const models = new Set<string>()
        for (const item of items) {
          if (item.model) models.add(item.model)
        }
        modelsUsed = models.size
      }
    } catch { /* non-fatal */ }

    const status = creditBalance < 2 ? 'warning' : 'healthy'
    return { creditBalance, monthlySpend, requests24h, modelsUsed, totalTokens, status }
  } catch {
    return { creditBalance: null, monthlySpend: null, requests24h: null, modelsUsed: null, totalTokens: null, status: 'unknown', error: 'Network error' }
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
  keyGuide: {
    url: 'https://openrouter.ai/settings/management-keys',
    steps: [
      'Go to openrouter.ai and sign in to your account.',
      'Navigate to Settings → Management Keys in the left sidebar.',
      'Click "Create Management Key" and give it a name.',
      'Copy the generated key — Management Keys have access to activity and usage data.',
    ],
  },
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
    {
      id: 'total_tokens',
      name: 'Total Tokens',
      metricType: 'count',
      unit: 'tokens',
      refreshInterval: 300,
      description: 'Total token usage across all models (30 days)',
      trend: true,
    },
  ],
  mockFetchMetrics,
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
      { collectorId: 'total_tokens', value: r.totalTokens ?? null, valueText: null, unit: 'tokens', status: r.status },
    ]
  },
}
