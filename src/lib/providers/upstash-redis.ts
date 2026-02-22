import type { ServiceProvider } from './types'

export const upstashRedisProvider: ServiceProvider = {
  id: 'upstash-redis',
  name: 'Upstash Redis',
  category: 'infrastructure',
  icon: '/icons/upstash.svg',
  authType: 'api_key',
  credentials: [
    { key: 'email', label: 'Upstash Email', type: 'text', required: true, placeholder: 'you@example.com' },
    { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'upstash_redis_...' },
    { key: 'databaseId', label: 'Database ID', type: 'text', required: true, placeholder: 'xxxxxxxx-xxxx-...' },
  ],
  collectors: [
    { id: 'daily_commands', name: 'Daily Commands', metricType: 'count', unit: 'commands', refreshInterval: 300, description: 'Redis commands executed today', trend: true },
    { id: 'memory_usage_mb', name: 'Memory Usage', metricType: 'count', unit: 'MB', refreshInterval: 300, displayHint: 'number', description: 'Memory in use (MB)' },
    { id: 'connections', name: 'Connections', metricType: 'count', unit: 'connections', refreshInterval: 300, description: 'Active Redis connections' },
    { id: 'throughput', name: 'Throughput', metricType: 'count', unit: 'ops/s', refreshInterval: 300, description: 'Current operations per second' },
    { id: 'performance_metrics', name: 'Performance Metrics', metricType: 'status', unit: '', refreshInterval: 300, description: 'Detailed performance data (latency, hit rate, keys, DB size)' },
  ],
  alerts: [
    { id: 'high-memory', name: 'High Memory', collectorId: 'memory_usage_mb', condition: 'gt', defaultThreshold: 200, message: 'Redis memory > 200 MB' },
    { id: 'high-commands', name: 'High Commands', collectorId: 'daily_commands', condition: 'gt', defaultThreshold: 8000, message: 'Daily commands > 8000' },
  ],
  fetchMetrics: async (credentials) => {
    const r = await fetchUpstashRedisMetrics(credentials.email, credentials.apiKey, credentials.databaseId)
    const perfJson = JSON.stringify({
      avgLatencyMs: r.avgLatencyMs,
      hitRate: r.hitRate,
      keyCount: r.keyCount,
      dbSizeMb: r.dbSizeMb,
    })
    return [
      { collectorId: 'daily_commands', value: r.dailyCommands ?? null, valueText: null, unit: 'commands', status: r.status },
      { collectorId: 'memory_usage_mb', value: r.memoryUsedMb ?? null, valueText: r.memoryLimitMb ? `of ${r.memoryLimitMb} MB limit (${r.memoryPercent}%)` : null, unit: 'MB', status: r.status },
      { collectorId: 'connections', value: r.connections ?? null, valueText: null, unit: 'connections', status: r.status },
      { collectorId: 'throughput', value: r.throughput ?? null, valueText: null, unit: 'ops/s', status: r.status },
      { collectorId: 'performance_metrics', value: null, valueText: perfJson, unit: '', status: r.status },
    ]
  },
}

export interface UpstashRedisMetricResult {
  dailyCommands: number | null
  memoryUsedMb: number | null
  memoryLimitMb: number | null
  memoryPercent: number | null
  connections: number | null
  throughput: number | null
  avgLatencyMs: number | null
  hitRate: number | null
  keyCount: number | null
  dbSizeMb: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchUpstashRedisMetrics(
  email: string,
  apiKey: string,
  databaseId: string
): Promise<UpstashRedisMetricResult> {
  const nullResult: UpstashRedisMetricResult = {
    dailyCommands: null, memoryUsedMb: null, memoryLimitMb: null, memoryPercent: null,
    connections: null, throughput: null, avgLatencyMs: null, hitRate: null,
    keyCount: null, dbSizeMb: null, status: 'unknown',
  }
  try {
    const auth = Buffer.from(`${email}:${apiKey}`).toString('base64')
    const res = await fetch(`https://api.upstash.com/v2/redis/stats/${databaseId}`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (!res.ok) return { ...nullResult, error: `HTTP ${res.status}` }
    const json = await res.json()
    const r = json.result

    const dailyCommands = r.dailyrequests ?? 0
    const usedMemBytes = r.used_memory ?? 0
    const maxMemBytes = r.maxmemory ?? 0
    const memoryUsedMb = Math.round(usedMemBytes / 1024 / 1024 * 10) / 10
    const memoryLimitMb = maxMemBytes > 0 ? Math.round(maxMemBytes / 1024 / 1024 * 10) / 10 : null
    const memoryPercent = maxMemBytes > 0 ? Math.round((usedMemBytes / maxMemBytes) * 100) : 0
    const connections = r.connected_clients ?? null
    const throughput = r.instantaneous_ops_per_sec ?? null
    const keyCount = r.keycount ?? null
    const hits = r.keyspace_hits ?? 0
    const misses = r.keyspace_misses ?? 0
    const hitRate = (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 1000) / 10 : null
    const dbSizeMb = usedMemBytes > 0 ? memoryUsedMb : null
    const avgLatencyMs = r.avg_latency_usec != null ? Math.round(r.avg_latency_usec / 1000 * 10) / 10 : null

    const isWarning = memoryPercent > 80 || dailyCommands > 8000
    return {
      dailyCommands, memoryUsedMb, memoryLimitMb, memoryPercent,
      connections, throughput, avgLatencyMs, hitRate, keyCount, dbSizeMb,
      status: isWarning ? 'warning' : 'healthy',
    }
  } catch {
    return { ...nullResult, error: 'Network error' }
  }
}
