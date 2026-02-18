import type { ServiceProvider } from './types'

export const sentryProvider: ServiceProvider = {
  id: 'sentry',
  name: 'Sentry',
  category: 'monitoring',
  icon: '/icons/sentry.svg',
  authType: 'api_key',
  credentials: [
    { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
    { key: 'orgSlug', label: 'Organization Slug', type: 'text', required: true },
  ],
  collectors: [
    {
      id: 'error_count',
      name: 'Error Count (This Month)',
      metricType: 'count',
      unit: 'events',
      refreshInterval: 300,
      endpoint: '/api/0/organizations/{orgSlug}/stats_v2/',
    },
  ],
  alerts: [
    {
      id: 'high-error-count',
      name: 'High Error Count',
      collectorId: 'error_count',
      condition: 'gt',
      defaultThreshold: 8000,
      message: 'Sentry errors exceed {threshold} this month',
    },
  ],
}

export interface SentryMetricResult {
  status: 'healthy' | 'unknown'
  value?: number
  error?: string
}

export async function fetchSentryMetrics(authToken: string, orgSlug: string): Promise<SentryMetricResult> {
  try {
    const authRes = await fetch('https://sentry.io/api/0/organizations/', {
      headers: { Authorization: `Bearer ${authToken}` },
    })

    if (!authRes.ok) {
      return { status: 'unknown', error: `HTTP ${authRes.status}` }
    }

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end = now.toISOString()

    const statsRes = await fetch(
      `https://sentry.io/api/0/organizations/${orgSlug}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=error&start=${start}&end=${end}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    )

    if (!statsRes.ok) {
      return { status: 'unknown', error: `Stats HTTP ${statsRes.status}` }
    }

    const data = await statsRes.json()
    const total = data.groups.reduce(
      (sum: number, g: { totals: { 'sum(quantity)': number } }) => sum + g.totals['sum(quantity)'],
      0
    )

    return { status: 'healthy', value: total }
  } catch {
    return { status: 'unknown', error: 'Network error' }
  }
}
