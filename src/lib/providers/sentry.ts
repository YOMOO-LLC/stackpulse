import type { ServiceProvider, ProjectOption } from './types'
import { mockFetchMetrics } from './demo-sequences/sentry'

export const sentryProvider: ServiceProvider = {
  id: 'sentry',
  name: 'Sentry',
  category: 'monitoring',
  icon: '/icons/sentry.svg',
  authType: 'api_key',
  credentials: [
    { key: 'authToken', label: 'Auth Token', type: 'password', required: true, placeholder: 'sntryu_...' },
  ],
  keyGuide: {
    url: 'https://sentry.io/settings/account/api/auth-tokens/',
    steps: [
      'Go to Settings → Account → API → Personal Tokens.',
      'Click "Create New Token" and give it a name.',
      'Set permissions: Organization → Read, Issue & Event → Read, Project → Read.',
      'Click "Create Token" and copy it — it starts with sntryu_...',
    ],
  },
  projectSelector: {
    key: 'orgSlug',
    label: 'Select Organization',
    fetch: async (credentials) => {
      const token = credentials.authToken ?? credentials.access_token ?? ''
      return fetchSentryOrganizations(token)
    },
  },
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
      id: 'apdex',
      name: 'Apdex',
      metricType: 'count',
      unit: '',
      refreshInterval: 300,
      endpoint: '/api/0/organizations/{orgSlug}/events/',
      thresholds: { warning: 0.75, critical: 0.5, direction: 'below' },
      description: 'Apdex: user satisfaction score (0–1). Based on response time: >0.75 healthy, <0.5 critical.',
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
      id: 'low-apdex',
      name: 'Low Apdex Score',
      collectorId: 'apdex',
      condition: 'lt',
      defaultThreshold: 0.75,
      message: 'Apdex score dropped below {threshold}',
    },
  ],
  fetchMetrics: async (credentials) => {
    const token = credentials.authToken ?? credentials.access_token ?? ''
    const orgSlug = credentials.orgSlug ?? ''
    const r = await fetchSentryMetrics(token, orgSlug)
    return [
      { collectorId: 'unresolved_errors', value: r.unresolvedErrors, valueText: null, unit: 'issues', status: r.status },
      { collectorId: 'apdex', value: r.apdex, valueText: r.apdex != null ? r.apdex.toFixed(3) : null, unit: '', status: r.status },
      { collectorId: 'events_24h', value: r.events24h, valueText: null, unit: 'events', status: r.status },
      { collectorId: 'p95_latency', value: r.p95Latency, valueText: null, unit: 'ms', status: r.status },
    ]
  },
}

export interface SentryMetricResult {
  unresolvedErrors: number | null
  apdex: number | null
  events24h: number | null
  p95Latency: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchSentryOrganizations(authToken: string): Promise<ProjectOption[]> {
  const headers = { Authorization: `Bearer ${authToken}` }
  const res = await fetch('https://sentry.io/api/0/organizations/', { headers })
  if (!res.ok) return []
  const orgs: { slug: string; name?: string }[] = await res.json()
  return orgs.map((o) => ({ value: o.slug, label: o.name || o.slug }))
}

export async function fetchSentryMetrics(authToken: string, orgSlug: string): Promise<SentryMetricResult> {
  const nullResult: SentryMetricResult = {
    unresolvedErrors: null,
    apdex: null,
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

    // 4. Apdex + P95 latency via events (single call)
    let apdex: number | null = null
    let p95Latency: number | null = null
    try {
      const eventsRes = await fetch(
        `https://sentry.io/api/0/organizations/${orgSlug}/events/?dataset=transactions&field=p95(transaction.duration)&field=apdex()&statsPeriod=24h`,
        { headers }
      )
      if (eventsRes.ok) {
        const data = await eventsRes.json()
        if (data.data && data.data.length > 0) {
          const row = data.data[0]
          p95Latency = row['p95(transaction.duration)'] ?? null
          apdex = row['apdex()'] ?? null
        }
      }
    } catch {
      // leave as null
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (apdex !== null && apdex < 0.5) {
      status = 'critical'
    } else if (apdex !== null && apdex < 0.75) {
      status = 'warning'
    } else if (unresolvedErrors !== null && unresolvedErrors > 50) {
      status = 'critical'
    } else if (unresolvedErrors !== null && unresolvedErrors > 10) {
      status = 'warning'
    }

    return { unresolvedErrors, apdex, events24h, p95Latency, status }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}
