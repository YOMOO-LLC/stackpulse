import type { SnapshotResult } from '../fetch'

// Storyline: Healthy Supabase project — steady API traffic, normal DB load, Storage recovering
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy' },
    { collectorId: 'api_requests_24h', value: 12480, valueText: null, unit: 'req', status: 'healthy' },
    { collectorId: 'active_db_connections', value: 24, valueText: null, unit: '', status: 'healthy' },
    { collectorId: 'disk_usage_bytes', value: 5798205850, valueText: null, unit: 'bytes', status: 'healthy' },
    { collectorId: 'edge_function_count', value: 8, valueText: null, unit: 'functions', status: 'healthy' },
    { collectorId: 'db_health', value: null, valueText: 'ACTIVE_HEALTHY', unit: '', status: 'healthy' },
    { collectorId: 'auth_health', value: null, valueText: 'ACTIVE_HEALTHY', unit: '', status: 'healthy' },
    { collectorId: 'realtime_health', value: null, valueText: 'ACTIVE_HEALTHY', unit: '', status: 'healthy' },
    { collectorId: 'storage_health', value: null, valueText: 'COMING_UP', unit: '', status: 'warning' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // connection_status
  { collectorId: 'connection_status',     value: null,       valueText: 'connected',       unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'connection_status',     value: null,       valueText: 'connected',       unit: '',          status: 'healthy', hoursAgo: 0 },
  // api_requests_24h
  { collectorId: 'api_requests_24h',      value: 10560,      valueText: null,              unit: 'req',       status: 'healthy', hoursAgo: 48 },
  { collectorId: 'api_requests_24h',      value: 12480,      valueText: null,              unit: 'req',       status: 'healthy', hoursAgo: 0 },
  // active_db_connections
  { collectorId: 'active_db_connections', value: 18,         valueText: null,              unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'active_db_connections', value: 24,         valueText: null,              unit: '',          status: 'healthy', hoursAgo: 0 },
  // disk_usage_bytes
  { collectorId: 'disk_usage_bytes',      value: 5600000000, valueText: null,              unit: 'bytes',     status: 'healthy', hoursAgo: 48 },
  { collectorId: 'disk_usage_bytes',      value: 5798205850, valueText: null,              unit: 'bytes',     status: 'healthy', hoursAgo: 0 },
  // edge_function_count
  { collectorId: 'edge_function_count',   value: 7,          valueText: null,              unit: 'functions', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'edge_function_count',   value: 8,          valueText: null,              unit: 'functions', status: 'healthy', hoursAgo: 0 },
  // service health
  { collectorId: 'db_health',             value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'db_health',             value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 0 },
  { collectorId: 'auth_health',           value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'auth_health',           value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 0 },
  { collectorId: 'realtime_health',       value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'realtime_health',       value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 0 },
  { collectorId: 'storage_health',        value: null,       valueText: 'ACTIVE_HEALTHY',  unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'storage_health',        value: null,       valueText: 'COMING_UP',       unit: '',          status: 'warning', hoursAgo: 0 },
]
