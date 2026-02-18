/**
 * Unified metric fetching dispatcher.
 * Each provider case calls its dedicated fetch function and normalises the result.
 * New providers (Phase 2) should add cases to this switch.
 */
import { fetchOpenRouterMetrics } from './openrouter'
import { fetchResendMetrics } from './resend'
import { fetchSentryMetrics } from './sentry'

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
    // Phase 2 providers added below by providers agent:
    // case 'stripe': ...
    // case 'github': ...
    // case 'vercel': ...
    // case 'openai': ...
    // case 'upstash-redis': ...
    // case 'upstash-qstash': ...
    default:
      console.warn(`[fetchProviderMetrics] Unknown provider: ${providerId}`)
      return []
  }
}
