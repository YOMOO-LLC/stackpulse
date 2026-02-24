import type { SnapshotResult } from '../fetch'

// Storyline: Normal delivery, 1 failed message in DLQ
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'messages_delivered', value: 1842, valueText: null, unit: 'messages', status: 'healthy' },
    { collectorId: 'messages_failed', value: 1, valueText: null, unit: 'messages', status: 'warning' },
    { collectorId: 'dlq_depth', value: 1, valueText: null, unit: 'messages', status: 'warning' },
    { collectorId: 'monthly_quota', value: 1843, valueText: '1,843 / 500,000', unit: 'messages', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago -- healthy
  { collectorId: 'messages_delivered', value: 920, valueText: null, unit: 'messages', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'messages_failed', value: 0, valueText: null, unit: 'messages', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'dlq_depth', value: 0, valueText: null, unit: 'messages', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'monthly_quota', value: 920, valueText: '920 / 500,000', unit: 'messages', status: 'healthy', hoursAgo: 48 },
  // 12h ago -- failure appears
  { collectorId: 'messages_delivered', value: 1561, valueText: null, unit: 'messages', status: 'healthy', hoursAgo: 12 },
  { collectorId: 'messages_failed', value: 1, valueText: null, unit: 'messages', status: 'warning', hoursAgo: 12 },
  { collectorId: 'dlq_depth', value: 1, valueText: null, unit: 'messages', status: 'warning', hoursAgo: 12 },
  { collectorId: 'monthly_quota', value: 1562, valueText: '1,562 / 500,000', unit: 'messages', status: 'healthy', hoursAgo: 12 },
  // 0h
  { collectorId: 'messages_delivered', value: 1842, valueText: null, unit: 'messages', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'messages_failed', value: 1, valueText: null, unit: 'messages', status: 'warning', hoursAgo: 0 },
  { collectorId: 'dlq_depth', value: 1, valueText: null, unit: 'messages', status: 'warning', hoursAgo: 0 },
  { collectorId: 'monthly_quota', value: 1843, valueText: '1,843 / 500,000', unit: 'messages', status: 'healthy', hoursAgo: 0 },
]
