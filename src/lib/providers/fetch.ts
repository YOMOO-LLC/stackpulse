/**
 * Unified metric fetching dispatcher.
 * Each provider owns its fetchMetrics() — no switch needed here.
 */
import { getProvider } from './registry'

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
  const provider = getProvider(providerId)
  if (!provider) {
    console.warn(`[fetchProviderMetrics] Unknown provider: ${providerId}`)
    return []
  }
  if (credentials.__demo__ === 'true') {
    return provider.mockFetchMetrics?.() ?? []
  }
  return provider.fetchMetrics(credentials)
}
