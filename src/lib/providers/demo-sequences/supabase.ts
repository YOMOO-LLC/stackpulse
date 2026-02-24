import type { SnapshotResult } from '../fetch'

// Storyline: Connection healthy
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy', hoursAgo: 0 },
]
