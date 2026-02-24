import type { SnapshotResult } from '../fetch'

// Storyline: Connection healthy
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'emails_sent_24h', value: 142, valueText: null, unit: 'emails', status: 'healthy' },
    { collectorId: 'bounce_rate', value: 0.8, valueText: '0.8%', unit: '%', status: 'healthy' },
    { collectorId: 'domain_health', value: null, valueText: 'verified', unit: '', status: 'healthy' },
    { collectorId: 'monthly_quota', value: 142, valueText: '142 / 3,000', unit: 'emails', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago
  { collectorId: 'emails_sent_24h', value: 98, valueText: null, unit: 'emails', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'bounce_rate', value: 0.9, valueText: '0.9%', unit: '%', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'domain_health', value: null, valueText: 'verified', unit: '', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'monthly_quota', value: 98, valueText: '98 / 3,000', unit: 'emails', status: 'healthy', hoursAgo: 48 },
  // 0h
  { collectorId: 'emails_sent_24h', value: 142, valueText: null, unit: 'emails', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'bounce_rate', value: 0.8, valueText: '0.8%', unit: '%', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'domain_health', value: null, valueText: 'verified', unit: '', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'monthly_quota', value: 142, valueText: '142 / 3,000', unit: 'emails', status: 'healthy', hoursAgo: 0 },
]
