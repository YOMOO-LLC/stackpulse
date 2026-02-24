import type { SnapshotResult } from '../fetch'

// Storyline: Balance $1,240 with 1 active dispute ($89) -> Critical alert
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'account_balance', value: 1240, valueText: null, unit: 'USD', status: 'healthy' },
    { collectorId: 'charges_24h', value: 47, valueText: '$3,210 total volume', unit: 'charges', status: 'healthy' },
    { collectorId: 'active_disputes', value: 1, valueText: '$89 at risk', unit: 'disputes', status: 'critical' },
    { collectorId: 'active_subscriptions', value: 3, valueText: 'MRR $890', unit: 'subscriptions', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago
  { collectorId: 'account_balance', value: 1540, valueText: null, unit: 'USD', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'charges_24h', value: 32, valueText: '$2,100 total volume', unit: 'charges', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'active_disputes', value: 0, valueText: null, unit: 'disputes', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'active_subscriptions', value: 3, valueText: 'MRR $890', unit: 'subscriptions', status: 'healthy', hoursAgo: 48 },
  // 24h ago -- dispute appears
  { collectorId: 'account_balance', value: 1350, valueText: null, unit: 'USD', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'charges_24h', value: 41, valueText: '$2,900 total volume', unit: 'charges', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'active_disputes', value: 1, valueText: '$89 at risk', unit: 'disputes', status: 'critical', hoursAgo: 24 },
  { collectorId: 'active_subscriptions', value: 3, valueText: 'MRR $890', unit: 'subscriptions', status: 'healthy', hoursAgo: 24 },
  // 0h -- current
  { collectorId: 'account_balance', value: 1240, valueText: null, unit: 'USD', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'charges_24h', value: 47, valueText: '$3,210 total volume', unit: 'charges', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'active_disputes', value: 1, valueText: '$89 at risk', unit: 'disputes', status: 'critical', hoursAgo: 0 },
  { collectorId: 'active_subscriptions', value: 3, valueText: 'MRR $890', unit: 'subscriptions', status: 'healthy', hoursAgo: 0 },
]
