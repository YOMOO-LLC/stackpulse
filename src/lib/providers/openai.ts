import type { ServiceProvider } from './types'

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
    { id: 'credit_balance', name: 'Credit Balance', metricType: 'currency', unit: 'USD', refreshInterval: 300 },
    { id: 'monthly_usage', name: 'Monthly Usage', metricType: 'currency', unit: 'USD', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'low-credits', name: 'Low Credits', collectorId: 'credit_balance', condition: 'lt', defaultThreshold: 5, message: 'OpenAI credits below $5' },
    { id: 'high-usage', name: 'High Usage', collectorId: 'monthly_usage', condition: 'gt', defaultThreshold: 50, message: 'OpenAI monthly usage > $50' },
  ],
}

export interface OpenAIMetricResult {
  creditBalance: number | null
  monthlyUsage: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchOpenAIMetrics(apiKey: string): Promise<OpenAIMetricResult> {
  const headers = { Authorization: `Bearer ${apiKey}` }
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  try {
    const [grantsRes, usageRes] = await Promise.all([
      fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', { headers }),
      fetch(`https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, { headers }),
    ])
    if (!grantsRes.ok || !usageRes.ok) return { creditBalance: null, monthlyUsage: null, status: 'unknown', error: 'API error' }

    const grantsJson = await grantsRes.json()
    const usageJson = await usageRes.json()

    const grants = grantsJson.grants?.data ?? []
    const creditBalance = grants.reduce((sum: number, g: { grant_amount: number; used_amount: number }) =>
      sum + (g.grant_amount - g.used_amount), 0)
    const monthlyUsage = (usageJson.total_usage ?? 0) / 100 // cents to dollars

    let status: OpenAIMetricResult['status'] = 'healthy'
    if (creditBalance < 5 || monthlyUsage > 50) status = 'warning'

    return { creditBalance, monthlyUsage, status }
  } catch {
    return { creditBalance: null, monthlyUsage: null, status: 'unknown', error: 'Network error' }
  }
}
