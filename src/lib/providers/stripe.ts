import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/stripe'

const ACTIVE_DISPUTE_STATUSES = ['warning_needs_response', 'needs_response', 'under_review']

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
    {
      id: 'charges_24h',
      name: 'Charges (24h)',
      metricType: 'count', unit: 'charges', refreshInterval: 300,
      description: 'Number of charges in the last 24 hours',
    },
    {
      id: 'active_disputes',
      name: 'Active Disputes',
      metricType: 'count', unit: 'disputes', refreshInterval: 300,
      description: 'Number of active disputes requiring attention',
      thresholds: { warning: 1, critical: 5, direction: 'above' },
    },
    {
      id: 'active_subscriptions',
      name: 'Active Subscriptions',
      metricType: 'count', unit: 'subscriptions', refreshInterval: 300,
      description: 'Number of active subscriptions',
    },
  ],
  mockFetchMetrics,
  alerts: [
    { id: 'low-balance', name: 'Low Balance', collectorId: 'account_balance', condition: 'lt', defaultThreshold: 100, message: 'Stripe balance below $100' },
    { id: 'active-dispute', name: 'Active Dispute', collectorId: 'active_disputes', condition: 'gt', defaultThreshold: 0, message: 'Active dispute requires attention' },
    { id: 'high-charges', name: 'High Charges', collectorId: 'charges_24h', condition: 'gt', defaultThreshold: 1000, message: 'Unusually high charge volume in 24h' },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchStripeMetrics(credentials.apiKey)
    return [
      { collectorId: 'account_balance', value: r.balance, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'charges_24h', value: r.charges24h, valueText: r.chargesVolume24h != null ? `$${r.chargesVolume24h} total volume` : null, unit: 'charges', status: r.status },
      { collectorId: 'active_disputes', value: r.activeDisputes, valueText: r.disputeAmount != null ? `$${r.disputeAmount} at risk` : null, unit: 'disputes', status: r.status },
      { collectorId: 'active_subscriptions', value: r.activeSubscriptions, valueText: r.monthlyRecurringRevenue != null ? `MRR $${r.monthlyRecurringRevenue}` : null, unit: 'subscriptions', status: r.status },
    ]
  },
}

export interface StripeMetricResult {
  balance: number | null
  charges24h: number | null
  chargesVolume24h: number | null
  activeDisputes: number | null
  disputeAmount: number | null
  activeSubscriptions: number | null
  monthlyRecurringRevenue: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchStripeMetrics(apiKey: string): Promise<StripeMetricResult> {
  const headers = { Authorization: `Bearer ${apiKey}` }

  try {
    // 1. Balance
    const balanceRes = await fetch('https://api.stripe.com/v1/balance', { headers })
    if (!balanceRes.ok) {
      return { balance: null, charges24h: null, chargesVolume24h: null, activeDisputes: null, disputeAmount: null, activeSubscriptions: null, monthlyRecurringRevenue: null, status: 'unknown', error: `HTTP ${balanceRes.status}` }
    }
    const balanceJson = await balanceRes.json()
    const available = balanceJson.available as Array<{ amount: number; currency: string }>
    const usd = available.find((a) => a.currency === 'usd')
    const balance = usd ? usd.amount / 100 : 0

    // 2. Charges (last 24h)
    const twentyFourHoursAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
    const chargesRes = await fetch(`https://api.stripe.com/v1/charges?limit=100&created[gte]=${twentyFourHoursAgo}`, { headers })
    const chargesJson = await chargesRes.json()
    const chargesData = chargesJson.data as Array<{ amount: number }>
    const charges24h = chargesData.length
    const chargesVolume24h = chargesData.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) / 100

    // 3. Disputes
    const disputesRes = await fetch('https://api.stripe.com/v1/disputes?limit=100', { headers })
    const disputesJson = await disputesRes.json()
    const allDisputes = disputesJson.data as Array<{ status: string; amount: number }>
    const activeDisputesList = allDisputes.filter((d) => ACTIVE_DISPUTE_STATUSES.includes(d.status))
    const activeDisputes = activeDisputesList.length
    const disputeAmount = activeDisputesList.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0) / 100

    // 4. Subscriptions
    const subsRes = await fetch('https://api.stripe.com/v1/subscriptions?status=active&limit=100', { headers })
    const subsJson = await subsRes.json()
    const subsData = subsJson.data as Array<{ plan: { amount: number; interval: string } }>
    const activeSubscriptions = subsData.length
    const monthlyRecurringRevenue = Math.round(
      subsData.reduce((sum: number, s) => {
        const monthlyAmount = s.plan.interval === 'year' ? s.plan.amount / 100 / 12 : s.plan.amount / 100
        return sum + monthlyAmount
      }, 0)
    )

    // Status logic
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (activeDisputes >= 5) {
      status = 'critical'
    } else if (activeDisputes >= 1 || balance < 100) {
      status = 'warning'
    }

    return { balance, charges24h, chargesVolume24h, activeDisputes, disputeAmount, activeSubscriptions, monthlyRecurringRevenue, status }
  } catch {
    return { balance: null, charges24h: null, chargesVolume24h: null, activeDisputes: null, disputeAmount: null, activeSubscriptions: null, monthlyRecurringRevenue: null, status: 'unknown', error: 'Network error' }
  }
}
