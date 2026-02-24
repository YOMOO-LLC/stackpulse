import type { SnapshotResult } from '../fetch'

// Storyline: Bandwidth healthy, 3 recent successful deployments
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'deployments_24h', value: 3, valueText: null, unit: 'deployments', status: 'healthy' },
    { collectorId: 'bandwidth_used', value: 8.4, valueText: '8.4 GB', unit: 'GB', status: 'healthy' },
    { collectorId: 'serverless_invocations', value: 142500, valueText: '142.5K', unit: 'invocations', status: 'healthy' },
    { collectorId: 'active_domains', value: 2, valueText: null, unit: 'domains', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago
  { collectorId: 'deployments_24h', value: 1, valueText: null, unit: 'deployments', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'bandwidth_used', value: 6.1, valueText: '6.1 GB', unit: 'GB', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'serverless_invocations', value: 98000, valueText: '98K', unit: 'invocations', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'active_domains', value: 2, valueText: null, unit: 'domains', status: 'healthy', hoursAgo: 48 },
  // 24h ago
  { collectorId: 'deployments_24h', value: 2, valueText: null, unit: 'deployments', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'bandwidth_used', value: 7.2, valueText: '7.2 GB', unit: 'GB', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'serverless_invocations', value: 118000, valueText: '118K', unit: 'invocations', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'active_domains', value: 2, valueText: null, unit: 'domains', status: 'healthy', hoursAgo: 24 },
  // 0h
  { collectorId: 'deployments_24h', value: 3, valueText: null, unit: 'deployments', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'bandwidth_used', value: 8.4, valueText: '8.4 GB', unit: 'GB', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'serverless_invocations', value: 142500, valueText: '142.5K', unit: 'invocations', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'active_domains', value: 2, valueText: null, unit: 'domains', status: 'healthy', hoursAgo: 0 },
]
