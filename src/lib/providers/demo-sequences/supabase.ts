import type { SnapshotResult } from '../fetch'

// Storyline: Healthy Supabase account with 3 active projects
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy' },
    { collectorId: 'project_count', value: 3, valueText: null, unit: 'projects', status: 'healthy' },
    { collectorId: 'active_project_count', value: 3, valueText: null, unit: 'projects', status: 'healthy' },
    { collectorId: 'edge_function_count', value: 8, valueText: null, unit: 'functions', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  { collectorId: 'connection_status',    value: null, valueText: 'connected', unit: '',          status: 'healthy', hoursAgo: 48 },
  { collectorId: 'connection_status',    value: null, valueText: 'connected', unit: '',          status: 'healthy', hoursAgo: 0 },
  { collectorId: 'project_count',        value: 3,    valueText: null,        unit: 'projects',  status: 'healthy', hoursAgo: 48 },
  { collectorId: 'project_count',        value: 3,    valueText: null,        unit: 'projects',  status: 'healthy', hoursAgo: 0 },
  { collectorId: 'active_project_count', value: 3,    valueText: null,        unit: 'projects',  status: 'healthy', hoursAgo: 48 },
  { collectorId: 'active_project_count', value: 3,    valueText: null,        unit: 'projects',  status: 'healthy', hoursAgo: 0 },
  { collectorId: 'edge_function_count',  value: 7,    valueText: null,        unit: 'functions', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'edge_function_count',  value: 8,    valueText: null,        unit: 'functions', status: 'healthy', hoursAgo: 0 },
]
