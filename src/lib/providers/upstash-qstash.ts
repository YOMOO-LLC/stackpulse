import type { ServiceProvider } from './types'
import { mockFetchMetrics } from './demo-sequences/upstash-qstash'

export const upstashQStashProvider: ServiceProvider = {
  id: 'upstash-qstash',
  name: 'Upstash QStash',
  category: 'infrastructure',
  icon: '/icons/upstash.svg',
  authType: 'token',
  credentials: [
    { key: 'token', label: 'QStash Token', type: 'password', required: true, placeholder: 'qstash_...' },
  ],
  keyGuide: {
    url: 'https://console.upstash.com/qstash',
    steps: [
      'Go to console.upstash.com and sign in.',
      'Navigate to QStash in the top navigation.',
      'Your QStash token is shown on the main page.',
      'Copy the token — it starts with qstash_...',
    ],
  },
  collectors: [
    { id: 'messages_delivered', name: 'Messages Delivered', metricType: 'count', unit: 'messages', refreshInterval: 300, description: 'Messages delivered this month', trend: true },
    { id: 'messages_failed', name: 'Messages Failed', metricType: 'count', unit: 'messages', refreshInterval: 300, thresholds: { warning: 5, critical: 20, direction: 'above' }, description: 'Failed deliveries this month', trend: true },
    { id: 'dlq_depth', name: 'DLQ Depth', metricType: 'count', unit: 'messages', refreshInterval: 300, thresholds: { warning: 1, critical: 10, direction: 'above' }, description: 'Messages in dead letter queue' },
    { id: 'monthly_quota', name: 'Monthly Quota', metricType: 'percentage', unit: '%', refreshInterval: 300, displayHint: 'progress', thresholds: { warning: 70, critical: 90, direction: 'above', max: 100 }, description: 'Monthly quota consumed %' },
  ],
  mockFetchMetrics,
  alerts: [
    { id: 'dlq-depth', name: 'DLQ Depth', collectorId: 'dlq_depth', condition: 'gt', defaultThreshold: 0, message: 'Messages in dead letter queue' },
    { id: 'high-quota', name: 'High Quota', collectorId: 'monthly_quota', condition: 'gt', defaultThreshold: 80, message: 'QStash quota > 80%' },
    { id: 'failed-msgs', name: 'Failed Messages', collectorId: 'messages_failed', condition: 'gt', defaultThreshold: 10, message: 'More than 10 failed messages' },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchUpstashQStashMetrics(credentials.token)
    return [
      { collectorId: 'messages_delivered', value: r.messagesDelivered ?? null, valueText: null, unit: 'messages', status: r.status },
      { collectorId: 'messages_failed', value: r.messagesFailed ?? null, valueText: null, unit: 'messages', status: r.status },
      { collectorId: 'dlq_depth', value: r.dlqDepth ?? null, valueText: null, unit: 'messages', status: r.status },
      { collectorId: 'monthly_quota', value: r.quotaUsed ?? null, valueText: r.monthlyLimit ? `${r.messagesDelivered?.toLocaleString()} of ${r.monthlyLimit.toLocaleString()} messages` : null, unit: '%', status: r.status },
    ]
  },
}

export interface UpstashQStashMetricResult {
  messagesDelivered: number | null
  messagesFailed: number | null
  dlqDepth: number | null
  quotaUsed: number | null
  monthlyLimit: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchUpstashQStashMetrics(token: string): Promise<UpstashQStashMetricResult> {
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const [statsRes, dlqRes] = await Promise.all([
      fetch('https://qstash.upstash.io/v2/stats', { headers }),
      fetch('https://qstash.upstash.io/v2/dlq', { headers }),
    ])

    if (!statsRes.ok) return { messagesDelivered: null, messagesFailed: null, dlqDepth: null, quotaUsed: null, monthlyLimit: null, status: 'unknown', error: `HTTP ${statsRes.status}` }

    const json = await statsRes.json()
    const messagesDelivered = json.messagesDelivered ?? 0
    const messagesFailed = json.messagesFailed ?? 0
    const monthlyLimit = json.monthlyLimit ?? 500
    const quotaUsed = Math.round((messagesDelivered / monthlyLimit) * 100)

    let dlqDepth: number | null = null
    if (dlqRes.ok) {
      const dlqJson = await dlqRes.json()
      const msgs = dlqJson.messages ?? dlqJson ?? []
      dlqDepth = Array.isArray(msgs) ? msgs.length : null
    }

    // Use failure rate (%) rather than absolute count so low-volume services aren't penalised
    const failureRate = messagesDelivered > 0 ? (messagesFailed / messagesDelivered) * 100 : 0
    let status: UpstashQStashMetricResult['status'] = 'healthy'
    if (quotaUsed > 90 || failureRate > 5 || (dlqDepth !== null && dlqDepth > 10)) {
      status = 'warning'
    }

    return { messagesDelivered, messagesFailed, dlqDepth, quotaUsed, monthlyLimit, status }
  } catch {
    return { messagesDelivered: null, messagesFailed: null, dlqDepth: null, quotaUsed: null, monthlyLimit: null, status: 'unknown', error: 'Network error' }
  }
}
