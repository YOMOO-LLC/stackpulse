import type { ServiceProvider } from './types'

export interface ResendMetricResult {
  emailsSent24h: number | null
  deliveryRate: number | null
  bounceRate: number | null
  bounceCount: number | null
  verifiedDomains: number | null
  totalDomains: number | null
  monthlyQuota: number | null
  monthlyLimit: number | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchResendMetrics(apiKey: string): Promise<ResendMetricResult> {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const nullResult: ResendMetricResult = {
    emailsSent24h: null,
    deliveryRate: null,
    bounceRate: null,
    bounceCount: null,
    verifiedDomains: null,
    totalDomains: null,
    monthlyQuota: null,
    monthlyLimit: null,
    status: 'unknown',
  }

  try {
    const [domainsRes, emailsRes] = await Promise.all([
      fetch('https://api.resend.com/domains', { headers }),
      fetch('https://api.resend.com/emails?limit=100', { headers }),
    ])

    if (!domainsRes.ok && domainsRes.status === 401) {
      return { ...nullResult, error: 'Auth failed' }
    }

    // Domains
    let verifiedDomains = 0
    let totalDomains = 0
    if (domainsRes.ok) {
      const domainsJson = await domainsRes.json()
      const domains = domainsJson.data ?? []
      totalDomains = domains.length
      verifiedDomains = domains.filter((d: { status: string }) => d.status === 'verified').length
    }

    // Email stats
    let emailsSent24h: number | null = null
    let bounceRate: number | null = null
    let bounceCount: number | null = null
    let deliveryRate: number | null = null
    let monthlyQuota: number | null = null

    if (emailsRes.ok) {
      const emailsJson = await emailsRes.json()
      const emails = emailsJson.data ?? []
      const since24h = Date.now() - 24 * 60 * 60 * 1000
      const recent = emails.filter((e: { created_at: string }) => new Date(e.created_at).getTime() > since24h)
      emailsSent24h = recent.length
      const bounced = recent.filter((e: { last_event: string }) => e.last_event === 'bounced').length
      bounceCount = bounced
      bounceRate = emailsSent24h > 0 ? Math.round((bounced / emailsSent24h) * 1000) / 10 : 0
      deliveryRate = emailsSent24h > 0 ? Math.round(((emailsSent24h - bounced) / emailsSent24h) * 1000) / 10 : 100
      monthlyQuota = emails.length
    }

    let status: ResendMetricResult['status'] = 'healthy'
    if (!domainsRes.ok) {
      status = 'unknown'
    } else if (bounceRate !== null && bounceRate >= 5) {
      status = 'critical'
    } else if (bounceRate !== null && bounceRate >= 2) {
      status = 'warning'
    } else if (verifiedDomains < totalDomains) {
      status = 'warning'
    }

    return {
      emailsSent24h,
      deliveryRate,
      bounceRate,
      bounceCount,
      verifiedDomains,
      totalDomains,
      monthlyQuota,
      monthlyLimit: null,
      status,
    }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}

export const resendProvider: ServiceProvider = {
  id: 'resend',
  name: 'Resend',
  category: 'email',
  icon: '/icons/resend.svg',
  authType: 'api_key',
  credentials: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  collectors: [
    {
      id: 'emails_sent_24h',
      name: 'Emails Sent (24h)',
      metricType: 'count',
      unit: 'emails',
      refreshInterval: 300,
      endpoint: '/emails',
      description: 'Number of emails sent in the last 24 hours',
      trend: true,
    },
    {
      id: 'bounce_rate',
      name: 'Bounce Rate',
      metricType: 'percentage',
      unit: '%',
      refreshInterval: 300,
      endpoint: '/emails',
      description: 'Percentage of emails that bounced',
      displayHint: 'number',
      thresholds: { warning: 2, critical: 5, direction: 'above' },
    },
    {
      id: 'domain_health',
      name: 'Domain Health',
      metricType: 'count',
      unit: 'domains',
      refreshInterval: 300,
      endpoint: '/domains',
      description: 'Number of verified sending domains',
      displayHint: 'number',
    },
    {
      id: 'monthly_quota',
      name: 'Monthly Quota',
      metricType: 'count',
      unit: 'emails',
      refreshInterval: 300,
      endpoint: '/emails',
      description: 'Emails sent this month',
    },
  ],
  alerts: [
    {
      id: 'high-bounce-rate',
      name: 'High Bounce Rate',
      collectorId: 'bounce_rate',
      condition: 'gt',
      defaultThreshold: 2,
      message: 'Email bounce rate exceeds 2%',
    },
    {
      id: 'domain-unverified',
      name: 'No Verified Domains',
      collectorId: 'domain_health',
      condition: 'lt',
      defaultThreshold: 1,
      message: 'No verified sending domains detected',
    },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchResendMetrics(credentials.apiKey)
    return [
      { collectorId: 'emails_sent_24h', value: r.emailsSent24h ?? null, valueText: null, unit: 'emails', status: r.status },
      { collectorId: 'bounce_rate', value: r.bounceRate ?? null, valueText: null, unit: '%', status: r.status },
      { collectorId: 'domain_health', value: r.verifiedDomains ?? null, valueText: null, unit: 'domains', status: r.status },
      { collectorId: 'monthly_quota', value: r.monthlyQuota ?? null, valueText: null, unit: 'emails', status: r.status },
    ]
  },
}
