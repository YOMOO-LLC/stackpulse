import type { SnapshotResult } from '../fetch'

// Storyline: High success rate, 3 recent deployments, 4 projects
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'deployments_24h', value: 3, valueText: null, unit: 'deployments', status: 'healthy' },
    { collectorId: 'deploy_success_rate', value: 95, valueText: '95%', unit: '%', status: 'healthy' },
    { collectorId: 'serverless_invocations', value: 142500, valueText: '142.5K', unit: 'invocations', status: 'healthy' },
    { collectorId: 'project_count', value: 4, valueText: null, unit: 'projects', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago
  { collectorId: 'deployments_24h', value: 1, valueText: null, unit: 'deployments', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'deploy_success_rate', value: 100, valueText: '100%', unit: '%', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'serverless_invocations', value: 98000, valueText: '98K', unit: 'invocations', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'project_count', value: 3, valueText: null, unit: 'projects', status: 'healthy', hoursAgo: 48 },
  // 24h ago
  { collectorId: 'deployments_24h', value: 2, valueText: null, unit: 'deployments', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'deploy_success_rate', value: 100, valueText: '100%', unit: '%', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'serverless_invocations', value: 118000, valueText: '118K', unit: 'invocations', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'project_count', value: 4, valueText: null, unit: 'projects', status: 'healthy', hoursAgo: 24 },
  // 0h
  { collectorId: 'deployments_24h', value: 3, valueText: null, unit: 'deployments', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'deploy_success_rate', value: 95, valueText: '95%', unit: '%', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'serverless_invocations', value: 142500, valueText: '142.5K', unit: 'invocations', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'project_count', value: 4, valueText: null, unit: 'projects', status: 'healthy', hoursAgo: 0 },
]
