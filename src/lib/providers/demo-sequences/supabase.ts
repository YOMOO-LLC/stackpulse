import type { SnapshotResult } from '../fetch'

// Storyline: Healthy Supabase project — steady API traffic, normal DB load
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy' },
    { collectorId: 'api_requests_24h', value: 12480, valueText: null, unit: 'req', status: 'healthy' },
    { collectorId: 'active_db_connections', value: 24, valueText: null, unit: '', status: 'healthy' },
    { collectorId: 'edge_function_count', value: 8, valueText: null, unit: 'functions', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  { collectorId: 'connection_status',     value: null,  valueText: 'connected', unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'connection_status',     value: null,  valueText: 'connected', unit: '',          status: 'healthy', hoursAgo: 0 },
  { collectorId: 'api_requests_24h',      value: 11200, valueText: null,        unit: 'req',       status: 'healthy', hoursAgo: 48 },
  { collectorId: 'api_requests_24h',      value: 12480, valueText: null,        unit: 'req',       status: 'healthy', hoursAgo: 0 },
  { collectorId: 'active_db_connections', value: 18,    valueText: null,        unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'active_db_connections', value: 24,    valueText: null,        unit: '',          status: 'healthy', hoursAgo: 0 },
  { collectorId: 'edge_function_count',   value: 7,     valueText: null,        unit: 'functions', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'edge_function_count',   value: 8,     valueText: null,        unit: 'functions', status: 'healthy', hoursAgo: 0 },
]
