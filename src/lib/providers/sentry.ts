import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/sentry'

export const sentryProvider: ServiceProvider = {
  id: 'sentry',
  name: 'Sentry',
  category: 'monitoring',
  icon: '/icons/sentry.svg',
  authType: 'oauth2',
  credentials: [],
  collectors: [
    {
      id: 'unresolved_errors',
      name: 'Unresolved Errors',
      metricType: 'count',
      unit: 'issues',
      refreshInterval: 300,
      endpoint: '/api/0/organizations/{orgSlug}/issues/',
      thresholds: { warning: 10, critical: 50, direction: 'above' },
      description: 'Total unresolved issues across all projects',
      trend: true,
    },
    {
      id: 'crash_free_rate',
      name: 'Crash-Free Rate',
      metricType: 'percentage',
      unit: '%',
      refreshInterval: 300,
      endpoint: '/api/0/organizations/{orgSlug}/sessions/',
      thresholds: { warning: 99, critical: 97, direction: 'below' },
      description: 'Session crash-free rate in last 24h',
    },
    {
      id: 'events_24h',
      name: 'Events (24h)',
      metricType: 'count',
      unit: 'events',
      refreshInterval: 300,
      endpoint: '/api/0/organizations/{orgSlug}/stats_v2/',
      description: 'Error events in the last 24 hours',
      trend: true,
    },
    {
      id: 'p95_latency',
      name: 'P95 Latency',
      metricType: 'count',
      unit: 'ms',
      refreshInterval: 300,
      thresholds: { warning: 500, critical: 1000, direction: 'above' },
      description: 'P95 transaction latency',
    },
  ],
  mockFetchMetrics,
  alerts: [
    {
      id: 'high-unresolved',
      name: 'High Unresolved Errors',
      collectorId: 'unresolved_errors',
      condition: 'gt',
      defaultThreshold: 10,
      message: 'Unresolved Sentry errors exceed {threshold}',
    },
    {
      id: 'low-crash-free',
      name: 'Low Crash-Free Rate',
      collectorId: 'crash_free_rate',
      condition: 'lt',
      defaultThreshold: 99,
      message: 'Crash-free rate dropped below {threshold}%',
    },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.authToken
    const orgSlug = credentials.orgSlug ?? ''
    const r = await fetchSentryMetrics(token, orgSlug)
    return [
      { collectorId: 'unresolved_errors', value: r.unresolvedErrors, valueText: null, unit: 'issues', status: r.status },
      { collectorId: 'crash_free_rate', value: r.crashFreeRate, valueText: null, unit: '%', status: r.status },
      { collectorId: 'events_24h', value: r.events24h, valueText: null, unit: 'events', status: r.status },
      { collectorId: 'p95_latency', value: r.p95Latency, valueText: null, unit: 'ms', status: r.status },
    ]
  },
}

export interface SentryMetricResult {
  unresolvedErrors: number | null
  crashFreeRate: number | null
  events24h: number | null
  p95Latency: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchSentryMetrics(authToken: string, orgSlug: string): Promise<SentryMetricResult> {
  const nullResult: SentryMetricResult = {
    unresolvedErrors: null,
    crashFreeRate: null,
    events24h: null,
    p95Latency: null,
    status: 'unknown',
  }

  try {
    // 1. Verify auth
    const authRes = await fetch('https://sentry.io/api/0/organizations/', {
      headers: { Authorization: `Bearer ${authToken}` },
    })

    if (!authRes.ok) {
      return { ...nullResult, error: `HTTP ${authRes.status}` }
    }

    const headers = { Authorization: `Bearer ${authToken}` }

    // 2. Unresolved issues
    let unresolvedErrors: number | null = null
    try {
      const issuesRes = await fetch(
        `https://sentry.io/api/0/organizations/${orgSlug}/issues/?is_unresolved=1&limit=100`,
        { headers }
      )
      if (issuesRes.ok) {
        const xHits = issuesRes.headers.get('X-Hits')
        if (xHits) {
          unresolvedErrors = parseInt(xHits, 10)
        } else {
          const issues = await issuesRes.json()
          unresolvedErrors = issues.length
        }
      }
    } catch {
      // leave as null
    }

    // 3. Events 24h via stats_v2
    let events24h: number | null = null
    try {
      const statsRes = await fetch(
        `https://sentry.io/api/0/organizations/${orgSlug}/stats_v2/?field=sum(quantity)&category=error&groupBy=outcome&statsPeriod=24h`,
        { headers }
      )
      if (statsRes.ok) {
        const data = await statsRes.json()
        events24h = data.groups.reduce(
          (sum: number, g: { totals: { 'sum(quantity)': number } }) => sum + g.totals['sum(quantity)'],
          0
        )
      }
    } catch {
      // leave as null
    }

    // 4. Crash-free rate via sessions
    let crashFreeRate: number | null = null
    try {
      const sessionsRes = await fetch(
        `https://sentry.io/api/0/organizations/${orgSlug}/sessions/?groupBy=session.status&statsPeriod=24h`,
        { headers }
      )
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        const groups = data.groups as Array<{ by: { 'session.status': string }; totals: { 'count()': number } }>
        const total = groups.reduce((sum, g) => sum + g.totals['count()'], 0)
        const crashed = groups
          .filter((g) => g.by['session.status'] === 'crashed')
          .reduce((sum, g) => sum + g.totals['count()'], 0)
        if (total > 0) {
          crashFreeRate = ((total - crashed) / total) * 100
        }
      }
    } catch {
      // leave as null
    }

    // 5. P95 latency — skip for now
    const p95Latency: number | null = null

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (crashFreeRate !== null && crashFreeRate < 97) {
      status = 'critical'
    } else if (crashFreeRate !== null && crashFreeRate < 99) {
      status = 'warning'
    } else if (unresolvedErrors !== null && unresolvedErrors > 50) {
      status = 'critical'
    } else if (unresolvedErrors !== null && unresolvedErrors > 10) {
      status = 'warning'
    }

    return { unresolvedErrors, crashFreeRate, events24h, p95Latency, status }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}
