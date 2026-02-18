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
    { id: 'daily_commands', name: 'Daily Commands', metricType: 'count', unit: 'commands', refreshInterval: 300 },
    { id: 'memory_usage', name: 'Memory Usage', metricType: 'percentage', unit: '%', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'high-memory', name: 'High Memory', collectorId: 'memory_usage', condition: 'gt', defaultThreshold: 80, message: 'Redis memory > 80%' },
    { id: 'high-commands', name: 'High Commands', collectorId: 'daily_commands', condition: 'gt', defaultThreshold: 8000, message: 'Daily commands > 8000' },
  ],
}

export interface UpstashRedisMetricResult {
  dailyCommands: number | null
  memoryUsage: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchUpstashRedisMetrics(
  email: string,
  apiKey: string,
  databaseId: string
): Promise<UpstashRedisMetricResult> {
  try {
    const auth = Buffer.from(`${email}:${apiKey}`).toString('base64')
    const res = await fetch(`https://api.upstash.com/v2/redis/stats/${databaseId}`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (!res.ok) return { dailyCommands: null, memoryUsage: null, status: 'unknown', error: `HTTP ${res.status}` }
    const json = await res.json()
    const r = json.result
    const dailyCommands = r.dailyrequests ?? 0
    const memoryUsage = r.maxmemory > 0 ? Math.round((r.used_memory / r.maxmemory) * 100) : 0
    return { dailyCommands, memoryUsage, status: memoryUsage > 80 || dailyCommands > 8000 ? 'warning' : 'healthy' }
  } catch {
    return { dailyCommands: null, memoryUsage: null, status: 'unknown', error: 'Network error' }
  }
}
