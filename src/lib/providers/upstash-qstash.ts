import type { ServiceProvider } from './types'

export const upstashQStashProvider: ServiceProvider = {
  id: 'upstash-qstash',
  name: 'Upstash QStash',
  category: 'infrastructure',
  icon: '/icons/upstash.svg',
  authType: 'token',
  credentials: [
    { key: 'token', label: 'QStash Token', type: 'password', required: true, placeholder: 'qstash_...' },
  ],
  collectors: [
    { id: 'messages_delivered', name: 'Messages Delivered', metricType: 'count', unit: 'messages', refreshInterval: 300 },
    { id: 'messages_failed', name: 'Messages Failed', metricType: 'count', unit: 'messages', refreshInterval: 300 },
    { id: 'monthly_quota_used', name: 'Quota Used', metricType: 'percentage', unit: '%', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'high-quota', name: 'High Quota', collectorId: 'monthly_quota_used', condition: 'gt', defaultThreshold: 80, message: 'QStash quota > 80%' },
    { id: 'failed-msgs', name: 'Failed Messages', collectorId: 'messages_failed', condition: 'gt', defaultThreshold: 10, message: 'More than 10 failed messages' },
  ],
}

export interface UpstashQStashMetricResult {
  messagesDelivered: number | null
  messagesFailed: number | null
  quotaUsed: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchUpstashQStashMetrics(token: string): Promise<UpstashQStashMetricResult> {
  try {
    const res = await fetch('https://qstash.upstash.io/v2/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { messagesDelivered: null, messagesFailed: null, quotaUsed: null, status: 'unknown', error: `HTTP ${res.status}` }
    const json = await res.json()
    const messagesDelivered = json.messagesDelivered ?? 0
    const messagesFailed = json.messagesFailed ?? 0
    const monthlyLimit = json.monthlyLimit ?? 500
    const quotaUsed = Math.round((messagesDelivered / monthlyLimit) * 100)
    return {
      messagesDelivered,
      messagesFailed,
      quotaUsed,
      status: quotaUsed > 80 || messagesFailed > 10 ? 'warning' : 'healthy',
    }
  } catch {
    return { messagesDelivered: null, messagesFailed: null, quotaUsed: null, status: 'unknown', error: 'Network error' }
  }
}
