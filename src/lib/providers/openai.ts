import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/openai'

export const openaiProvider: ServiceProvider = {
  id: 'openai',
  name: 'OpenAI',
  category: 'ai',
  icon: '/icons/openai.svg',
  authType: 'api_key',
  credentials: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-admin-... (recommended) or sk-proj-...' },
  ],
  keyGuide: {
    url: 'https://platform.openai.com/settings/organization/admin-keys',
    steps: [
      'Go to platform.openai.com → Settings → Organization → Admin Keys.',
      'Click "Create new admin key" and give it a name.',
      'Copy the key — it starts with sk-admin-... (recommended for full usage data).',
      'Alternatively, use a project key (sk-proj-...) for basic health monitoring only.',
    ],
  },
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
      id: 'api_requests',
      name: 'API Requests',
      metricType: 'count', unit: 'requests', refreshInterval: 300,
      description: 'Total API requests across all models this month',
      displayHint: 'number',
      trend: true,
    },
    {
      id: 'model_usage',
      name: 'Usage by Model',
      metricType: 'count', unit: '', refreshInterval: 300,
      description: 'Per-model request and cost breakdown (JSON)',
      section: 'model_breakdown',
    },
  ],
  mockFetchMetrics,
  alerts: [
    { id: 'low-credits', name: 'Low Credits', collectorId: 'credit_balance', condition: 'lt', defaultThreshold: 5, message: 'OpenAI credits below $5' },
    { id: 'high-usage', name: 'High Usage', collectorId: 'monthly_usage', condition: 'gt', defaultThreshold: 50, message: 'OpenAI monthly usage > $50' },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchOpenAIMetrics(credentials.apiKey)
    const results = [
      { collectorId: 'monthly_usage', value: r.monthlyUsage ?? null, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'api_requests', value: r.apiRequests ?? null, valueText: null, unit: 'requests', status: r.status },
      { collectorId: 'model_usage', value: null, valueText: r.modelUsage ? JSON.stringify(r.modelUsage) : null, unit: '', status: r.status },
    ]
    // credit_balance is only available for legacy/project keys, not admin keys
    if (r.creditBalance !== null) {
      results.unshift({ collectorId: 'credit_balance', value: r.creditBalance, valueText: null, unit: 'USD', status: r.status })
    }
    return results
  },
}

export interface OpenAIMetricResult {
  creditBalance: number | null
  monthlyUsage: number | null
  apiRequests: number | null
  modelUsage: Array<{ model: string; requests: number; costUsd: number }> | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchOpenAIMetrics(apiKey: string): Promise<OpenAIMetricResult> {
  if (apiKey.startsWith('sk-admin-')) return fetchWithAdminKey(apiKey)

  const headers = { Authorization: `Bearer ${apiKey}` }
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const monthStartTs = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)

  try {
    const [grantsRes, usageRes] = await Promise.all([
      fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', { headers }),
      fetch(`https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, { headers }),
    ])
    if (!grantsRes.ok || !usageRes.ok) {
      // Billing endpoints may be restricted for project keys (sk-proj-...).
      // Fall back to /v1/models to verify the key is at least valid.
      const modelsRes = await fetch('https://api.openai.com/v1/models', { headers })
      if (!modelsRes.ok) {
        return { creditBalance: null, monthlyUsage: null, apiRequests: null, modelUsage: null, status: 'unknown', error: 'API error' }
      }
      // Key is valid but billing data is inaccessible
      return { creditBalance: null, monthlyUsage: null, apiRequests: null, modelUsage: null, status: 'healthy' }
    }

    const grantsJson = await grantsRes.json()
    const usageJson = await usageRes.json()

    const grants = grantsJson.grants?.data ?? []
    const creditBalance = grants.reduce((sum: number, g: { grant_amount: number; used_amount: number }) =>
      sum + (g.grant_amount - g.used_amount), 0)
    const monthlyUsage = (usageJson.total_usage ?? 0) / 100 // cents to dollars

    // Try org-level usage endpoint for model breakdown + request counts
    let apiRequests: number | null = null
    let modelUsage: OpenAIMetricResult['modelUsage'] = null

    try {
      const orgRes = await fetch(
        `https://api.openai.com/v1/organization/usage/completions?start_time=${monthStartTs}&bucket_width=1d&group_by[]=model`,
        { headers },
      )
      if (orgRes.ok) {
        const orgJson = await orgRes.json()
        const results: Array<{ model_id: string; num_model_requests: number; input_tokens: number; output_tokens: number }> =
          orgJson.data?.[0]?.results ?? []
        apiRequests = results.reduce((sum, r) => sum + r.num_model_requests, 0)
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

    return { creditBalance, monthlyUsage, apiRequests, modelUsage, status }
  } catch {
    return { creditBalance: null, monthlyUsage: null, apiRequests: null, modelUsage: null, status: 'unknown', error: 'Network error' }
  }
}

const nullResult: OpenAIMetricResult = {
  creditBalance: null, monthlyUsage: null, apiRequests: null,
  modelUsage: null, status: 'unknown',
}

async function fetchWithAdminKey(adminKey: string): Promise<OpenAIMetricResult> {
  const headers = { Authorization: `Bearer ${adminKey}` }
  const now = new Date()
  const monthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)

  try {
    const [costsRes, usageRes] = await Promise.all([
      fetch(`https://api.openai.com/v1/organization/costs?start_time=${monthStart}&bucket_width=1d`, { headers }),
      fetch(`https://api.openai.com/v1/organization/usage/completions?start_time=${monthStart}&bucket_width=1d&group_by[]=model`, { headers }),
    ])

    if (!costsRes.ok) {
      return { ...nullResult, error: `API error: ${costsRes.status}` }
    }

    const costsJson = await costsRes.json()
    const monthlyUsage = (costsJson.data ?? []).reduce(
      (sum: number, bucket: { results: Array<{ amount: { value: string } }> }) =>
        sum + bucket.results.reduce((s: number, r) => s + parseFloat(r.amount.value), 0),
      0,
    )

    let apiRequests: number | null = null
    let modelUsage: OpenAIMetricResult['modelUsage'] = null

    if (usageRes.ok) {
      const usageJson = await usageRes.json()
      const allResults: Array<{ model_id: string; num_model_requests: number }> =
        (usageJson.data ?? []).flatMap((b: { results: unknown[] }) => b.results)
      if (allResults.length > 0) {
        apiRequests = allResults.reduce((sum, r) => sum + r.num_model_requests, 0)
        // Aggregate by model across daily buckets
        const byModel = new Map<string, number>()
        for (const r of allResults) {
          byModel.set(r.model_id, (byModel.get(r.model_id) ?? 0) + r.num_model_requests)
        }
        modelUsage = [...byModel.entries()].map(([model, requests]) => ({
          model, requests, costUsd: 0,
        }))
      }
    }

    let status: OpenAIMetricResult['status'] = 'healthy'
    if (monthlyUsage > 50) status = 'warning'

    return { creditBalance: null, monthlyUsage, apiRequests, modelUsage, status }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}
