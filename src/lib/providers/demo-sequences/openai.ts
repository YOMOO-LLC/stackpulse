import type { SnapshotResult } from '../fetch'

// Storyline: Credits $12.50 -> declining to $3.80 (warning < $5)
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'credit_balance', value: 3.80, valueText: '$3.80', unit: 'USD', status: 'warning' },
    { collectorId: 'monthly_usage', value: 38, valueText: '$38 of $50', unit: 'USD', status: 'warning' },
    { collectorId: 'avg_latency', value: 420, valueText: null, unit: 'ms', status: 'healthy' },
    { collectorId: 'model_usage', value: null, valueText: 'gpt-4o-mini', unit: '', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago -- healthy
  { collectorId: 'credit_balance', value: 12.50, valueText: '$12.50', unit: 'USD', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'monthly_usage', value: 25, valueText: '$25 of $50', unit: 'USD', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'avg_latency', value: 380, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'model_usage', value: null, valueText: 'gpt-4o-mini', unit: '', status: 'healthy', hoursAgo: 48 },
  // 24h ago
  { collectorId: 'credit_balance', value: 7.20, valueText: '$7.20', unit: 'USD', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'monthly_usage', value: 32, valueText: '$32 of $50', unit: 'USD', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'avg_latency', value: 410, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'model_usage', value: null, valueText: 'gpt-4o-mini', unit: '', status: 'healthy', hoursAgo: 24 },
  // 0h -- warning (< $5 threshold)
  { collectorId: 'credit_balance', value: 3.80, valueText: '$3.80', unit: 'USD', status: 'warning', hoursAgo: 0 },
  { collectorId: 'monthly_usage', value: 38, valueText: '$38 of $50', unit: 'USD', status: 'warning', hoursAgo: 0 },
  { collectorId: 'avg_latency', value: 420, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'model_usage', value: null, valueText: 'gpt-4o-mini', unit: '', status: 'healthy', hoursAgo: 0 },
]
