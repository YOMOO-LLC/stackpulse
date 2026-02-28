import type { SnapshotResult } from '../fetch'

// Storyline: Credit balance $8.20, healthy
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'credit_balance', value: 8.20, valueText: '$8.20', unit: 'USD', status: 'healthy' },
    { collectorId: 'monthly_spend', value: 11.80, valueText: '$11.80', unit: 'USD', status: 'healthy' },
    { collectorId: 'requests_24h', value: 2340, valueText: null, unit: 'requests', status: 'healthy' },
    { collectorId: 'models_used', value: 3, valueText: null, unit: 'models', status: 'healthy' },
    { collectorId: 'total_tokens', value: 850000, valueText: null, unit: 'tokens', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago
  { collectorId: 'credit_balance', value: 12.50, valueText: '$12.50', unit: 'USD', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'monthly_spend', value: 7.50, valueText: '$7.50', unit: 'USD', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'requests_24h', value: 1800, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'models_used', value: 3, valueText: null, unit: 'models', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'total_tokens', value: 720000, valueText: null, unit: 'tokens', status: 'healthy', hoursAgo: 48 },
  // 0h
  { collectorId: 'credit_balance', value: 8.20, valueText: '$8.20', unit: 'USD', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'monthly_spend', value: 11.80, valueText: '$11.80', unit: 'USD', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'requests_24h', value: 2340, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'models_used', value: 3, valueText: null, unit: 'models', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'total_tokens', value: 850000, valueText: null, unit: 'tokens', status: 'healthy', hoursAgo: 0 },
]
