import type { SnapshotResult } from '../fetch'

// Storyline: Rate limit healthy (4,980) -> CI/CD spike -> drops to 1,240 (Warning)
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'rate_limit_remaining', value: 1240, valueText: null, unit: 'requests', status: 'warning' },
    { collectorId: 'rate_limit_used', value: 3760, valueText: null, unit: 'requests', status: 'warning' },
    { collectorId: 'graphql_rate_limit_remaining', value: 4800, valueText: null, unit: 'points', status: 'healthy' },
    { collectorId: 'search_rate_limit_remaining', value: 28, valueText: null, unit: 'requests', status: 'healthy' },
    { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
  hoursAgo: number
}

// 48h time series -- rate_limit_remaining declining from 4980 to 1240
export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago -- healthy
  { collectorId: 'rate_limit_remaining', value: 4980, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'rate_limit_used', value: 20, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'graphql_rate_limit_remaining', value: 5000, valueText: null, unit: 'points', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'search_rate_limit_remaining', value: 30, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy', hoursAgo: 48 },
  // 36h ago -- still healthy
  { collectorId: 'rate_limit_remaining', value: 4800, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 36 },
  { collectorId: 'rate_limit_used', value: 200, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 36 },
  { collectorId: 'graphql_rate_limit_remaining', value: 4900, valueText: null, unit: 'points', status: 'healthy', hoursAgo: 36 },
  { collectorId: 'search_rate_limit_remaining', value: 30, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 36 },
  { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy', hoursAgo: 36 },
  // 24h ago -- healthy, CI runs begin
  { collectorId: 'rate_limit_remaining', value: 4500, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'rate_limit_used', value: 500, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'graphql_rate_limit_remaining', value: 4800, valueText: null, unit: 'points', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'search_rate_limit_remaining', value: 29, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy', hoursAgo: 24 },
  // 12h ago -- CI/CD spike, dropping fast
  { collectorId: 'rate_limit_remaining', value: 2500, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 12 },
  { collectorId: 'rate_limit_used', value: 2500, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 12 },
  { collectorId: 'graphql_rate_limit_remaining', value: 4700, valueText: null, unit: 'points', status: 'healthy', hoursAgo: 12 },
  { collectorId: 'search_rate_limit_remaining', value: 28, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 12 },
  { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy', hoursAgo: 12 },
  // 6h ago -- warning territory
  { collectorId: 'rate_limit_remaining', value: 1800, valueText: null, unit: 'requests', status: 'warning', hoursAgo: 6 },
  { collectorId: 'rate_limit_used', value: 3200, valueText: null, unit: 'requests', status: 'warning', hoursAgo: 6 },
  { collectorId: 'graphql_rate_limit_remaining', value: 4800, valueText: null, unit: 'points', status: 'healthy', hoursAgo: 6 },
  { collectorId: 'search_rate_limit_remaining', value: 28, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 6 },
  { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy', hoursAgo: 6 },
  // 0h -- current (matches mockFetchMetrics)
  { collectorId: 'rate_limit_remaining', value: 1240, valueText: null, unit: 'requests', status: 'warning', hoursAgo: 0 },
  { collectorId: 'rate_limit_used', value: 3760, valueText: null, unit: 'requests', status: 'warning', hoursAgo: 0 },
  { collectorId: 'graphql_rate_limit_remaining', value: 4800, valueText: null, unit: 'points', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'search_rate_limit_remaining', value: 28, valueText: null, unit: 'requests', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'public_repos', value: 12, valueText: null, unit: 'repos', status: 'healthy', hoursAgo: 0 },
]
