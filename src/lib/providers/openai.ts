import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/openai'

export const openaiProvider: ServiceProvider = {
  id: 'openai',
  name: 'OpenAI',
  category: 'ai',
  icon: '/icons/openai.svg',
  authType: 'api_key',
  credentials: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
  ],
  collectors: [
    {
      id: 'credit_balance',
      name: 'Credit Balance',
      metricType: 'currency', unit: 'USD', refreshInterval: 300,
      description: 'Remaining prepaid OpenAI credits',
      displayHint: 'currency',
      thresholds: { warning: 5, critical: 1, direction: 'below' },
      trend: true,
    },
    {
      id: 'monthly_usage',
      name: 'Monthly Usage',
      metricType: 'currency', unit: 'USD', refreshInterval: 300,
      description: 'Total spend this calendar month',
      displayHint: 'currency',
      thresholds: { warning: 40, critical: 50, direction: 'above' },
      trend: true,
    },
    {
      id: 'api_requests_24h',
      name: 'API Requests (24h)',
      metricType: 'count', unit: 'requests', refreshInterval: 300,
      description: 'Total API requests across all models in the last 24 hours',
      displayHint: 'number',
      trend: true,
    },
    {
      id: 'avg_latency',
      name: 'Avg Latency',
      metricType: 'count', unit: 'ms', refreshInterval: 300,
      description: 'Average p50 response time',
      displayHint: 'number',
    },
    {
      id: 'model_usage',
      name: 'Usage by Model',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Per-model request and cost breakdown (JSON)',
    },
  ],
  mockFetchMetrics,
  alerts: [
    { id: 'low-credits', name: 'Low Credits', collectorId: 'credit_balance', condition: 'lt', defaultThreshold: 5, message: 'OpenAI credits below $5' },
    { id: 'high-usage', name: 'High Usage', collectorId: 'monthly_usage', condition: 'gt', defaultThreshold: 50, message: 'OpenAI monthly usage > $50' },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchOpenAIMetrics(credentials.apiKey)
    return [
      { collectorId: 'credit_balance', value: r.creditBalance ?? null, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'monthly_usage', value: r.monthlyUsage ?? null, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'api_requests_24h', value: r.apiRequests24h ?? null, valueText: null, unit: 'requests', status: r.status },
      { collectorId: 'avg_latency', value: r.avgLatency ?? null, valueText: null, unit: 'ms', status: r.status },
      { collectorId: 'model_usage', value: null, valueText: r.modelUsage ? JSON.stringify(r.modelUsage) : null, unit: '', status: r.status },
    ]
  },
}

export interface OpenAIMetricResult {
  creditBalance: number | null
  monthlyUsage: number | null
  apiRequests24h: number | null
  avgLatency: number | null
  modelUsage: Array<{ model: string; requests: number; costUsd: number }> | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchOpenAIMetrics(apiKey: string): Promise<OpenAIMetricResult> {
  const headers = { Authorization: `Bearer ${apiKey}` }
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const startTime24h = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000)

  try {
    const [grantsRes, usageRes] = await Promise.all([
      fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', { headers }),
      fetch(`https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, { headers }),
    ])
    if (!grantsRes.ok || !usageRes.ok) return { creditBalance: null, monthlyUsage: null, apiRequests24h: null, avgLatency: null, modelUsage: null, status: 'unknown', error: 'API error' }

    const grantsJson = await grantsRes.json()
    const usageJson = await usageRes.json()

    const grants = grantsJson.grants?.data ?? []
    const creditBalance = grants.reduce((sum: number, g: { grant_amount: number; used_amount: number }) =>
      sum + (g.grant_amount - g.used_amount), 0)
    const monthlyUsage = (usageJson.total_usage ?? 0) / 100 // cents to dollars

    // Try org-level usage endpoint for model breakdown + request counts
    let apiRequests24h: number | null = null
    let modelUsage: OpenAIMetricResult['modelUsage'] = null

    try {
      const orgRes = await fetch(
        `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime24h}&bucket_width=1d&group_by[]=model`,
        { headers },
      )
      if (orgRes.ok) {
        const orgJson = await orgRes.json()
        const results: Array<{ model_id: string; num_model_requests: number; input_tokens: number; output_tokens: number }> =
          orgJson.data?.[0]?.results ?? []
        apiRequests24h = results.reduce((sum, r) => sum + r.num_model_requests, 0)
        modelUsage = results.map(r => ({
          model: r.model_id,
          requests: r.num_model_requests,
          costUsd: 0, // actual cost calculation would need pricing data
        }))
      }
    } catch {
      // org endpoint not available, leave as null
    }

    let status: OpenAIMetricResult['status'] = 'healthy'
    if (creditBalance < 5 || monthlyUsage > 50) status = 'warning'

    return { creditBalance, monthlyUsage, apiRequests24h, avgLatency: null, modelUsage, status }
  } catch {
    return { creditBalance: null, monthlyUsage: null, apiRequests24h: null, avgLatency: null, modelUsage: null, status: 'unknown', error: 'Network error' }
  }
}
