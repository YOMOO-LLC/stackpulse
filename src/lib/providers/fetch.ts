/**
 * Unified metric fetching dispatcher.
 * Each provider case calls its dedicated fetch function and normalises the result.
 * New providers (Phase 2) should add cases to this switch.
 */
import { fetchOpenRouterMetrics } from './openrouter'
import { fetchResendMetrics } from './resend'
import { fetchSentryMetrics } from './sentry'
import { fetchStripeMetrics } from './stripe'
import { fetchGitHubMetrics } from './github'
import { fetchVercelMetrics } from './vercel'
import { fetchOpenAIMetrics } from './openai'
import { fetchUpstashRedisMetrics } from './upstash-redis'
import { fetchUpstashQStashMetrics } from './upstash-qstash'

export interface SnapshotResult {
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
}

export async function fetchProviderMetrics(
  providerId: string,
  credentials: Record<string, string>
): Promise<SnapshotResult[]> {
  switch (providerId) {
    case 'openrouter': {
      const r = await fetchOpenRouterMetrics(credentials.apiKey)
      return [{ collectorId: 'credit_balance', value: r.value ?? null, valueText: null, unit: 'USD', status: r.status }]
    }
    case 'resend': {
      const r = await fetchResendMetrics(credentials.apiKey)
      return [{ collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status }]
    }
    case 'sentry': {
      const r = await fetchSentryMetrics(credentials.authToken, credentials.orgSlug)
      return [{ collectorId: 'error_count', value: r.value ?? null, valueText: null, unit: 'events', status: r.status }]
    }
    case 'stripe': {
      const r = await fetchStripeMetrics(credentials.apiKey)
      return [{ collectorId: 'account_balance', value: r.balance ?? null, valueText: null, unit: 'USD', status: r.status }]
    }
    case 'github': {
      const r = await fetchGitHubMetrics(credentials.token)
      return [
        { collectorId: 'actions_minutes_used', value: r.minutesUsed ?? null, valueText: null, unit: 'minutes', status: r.status },
        { collectorId: 'actions_minutes_limit', value: r.minutesLimit ?? null, valueText: null, unit: 'minutes', status: 'healthy' },
      ]
    }
    case 'vercel': {
      const r = await fetchVercelMetrics(credentials.token)
      return [
        { collectorId: 'bandwidth_used', value: r.bandwidthUsed ?? null, valueText: null, unit: 'GB', status: r.status },
        { collectorId: 'deployment_status', value: null, valueText: r.deploymentStatus ?? null, unit: '', status: r.status },
      ]
    }
    case 'openai': {
      const r = await fetchOpenAIMetrics(credentials.apiKey)
      return [
        { collectorId: 'credit_balance', value: r.creditBalance ?? null, valueText: null, unit: 'USD', status: r.status },
        { collectorId: 'monthly_usage', value: r.monthlyUsage ?? null, valueText: null, unit: 'USD', status: r.status },
      ]
    }
    case 'upstash-redis': {
      const r = await fetchUpstashRedisMetrics(credentials.email, credentials.apiKey, credentials.databaseId)
      return [
        { collectorId: 'daily_commands', value: r.dailyCommands ?? null, valueText: null, unit: 'commands', status: r.status },
        { collectorId: 'memory_usage', value: r.memoryUsage ?? null, valueText: null, unit: '%', status: r.status },
      ]
    }
    case 'upstash-qstash': {
      const r = await fetchUpstashQStashMetrics(credentials.token)
      return [
        { collectorId: 'messages_delivered', value: r.messagesDelivered ?? null, valueText: null, unit: 'messages', status: r.status },
        { collectorId: 'messages_failed', value: r.messagesFailed ?? null, valueText: null, unit: 'messages', status: r.status },
        { collectorId: 'monthly_quota_used', value: r.quotaUsed ?? null, valueText: null, unit: '%', status: r.status },
      ]
    }
    default:
      console.warn(`[fetchProviderMetrics] Unknown provider: ${providerId}`)
      return []
  }
}
