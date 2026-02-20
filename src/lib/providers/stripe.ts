import type { ServiceProvider } from './types'

export const stripeProvider: ServiceProvider = {
  id: 'stripe',
  name: 'Stripe',
  category: 'payment',
  icon: '/icons/stripe.svg',
  authType: 'api_key',
  credentials: [
    { key: 'apiKey', label: 'Restricted API Key', type: 'password', required: true, placeholder: 'rk_live_...' },
  ],
  collectors: [
    {
      id: 'account_balance',
      name: 'Account Balance',
      metricType: 'currency', unit: 'USD', refreshInterval: 300,
      description: 'Available Stripe account balance in USD',
      displayHint: 'currency',
      thresholds: { warning: 100, critical: 20, direction: 'below' },
      trend: true,
    },
  ],
  alerts: [
    { id: 'low-balance', name: 'Low Balance', collectorId: 'account_balance', condition: 'lt', defaultThreshold: 100, message: 'Stripe balance below $100' },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchStripeMetrics(credentials.apiKey)
    return [{ collectorId: 'account_balance', value: r.balance ?? null, valueText: null, unit: 'USD', status: r.status }]
  },
}

export interface StripeMetricResult {
  balance: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchStripeMetrics(apiKey: string): Promise<StripeMetricResult> {
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return { balance: null, status: 'unknown', error: `HTTP ${res.status}` }
    const json = await res.json()
    const available = json.available as Array<{ amount: number; currency: string }>
    const usd = available.find((a) => a.currency === 'usd')
    const balance = usd ? usd.amount / 100 : 0
    return { balance, status: balance < 100 ? 'warning' : 'healthy' }
  } catch {
    return { balance: null, status: 'unknown', error: 'Network error' }
  }
}
