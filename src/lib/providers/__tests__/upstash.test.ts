import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchUpstashRedisMetrics } from '../upstash-redis'

const mockStats = (stats: {
  dailyrequests?: number
  used_memory?: number
  maxmemory?: number
  connected_clients?: number
  instantaneous_ops_per_sec?: number
  keyspace_hits?: number
  keyspace_misses?: number
  keycount?: number
  avg_latency_usec?: number
}) => ({
  ok: true,
  json: async () => ({ result: {
    dailyrequests: 0,
    used_memory: 0,
    maxmemory: 0,
    connected_clients: 0,
    instantaneous_ops_per_sec: 0,
    keyspace_hits: 0,
    keyspace_misses: 0,
    keycount: 0,
    ...stats,
  } }),
} as Response)

describe('fetchUpstashRedisMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns all metrics correctly from stats', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockStats({
      dailyrequests: 45200,
      used_memory: 134217728,   // 128 MB
      maxmemory: 268435456,     // 256 MB
      connected_clients: 42,
      instantaneous_ops_per_sec: 1200,
      keyspace_hits: 800,
      keyspace_misses: 200,
      keycount: 15000,
      avg_latency_usec: 1500,
    }))
    const r = await fetchUpstashRedisMetrics('email@example.com', 'apikey', 'db-id')
    expect(r.dailyCommands).toBe(45200)
    expect(r.memoryUsedMb).toBe(128)
    expect(r.memoryLimitMb).toBe(256)
    expect(r.memoryPercent).toBe(50)
    expect(r.connections).toBe(42)
    expect(r.throughput).toBe(1200)
    expect(r.hitRate).toBe(80)
    expect(r.keyCount).toBe(15000)
    expect(r.dbSizeMb).toBe(128)
    expect(r.avgLatencyMs).toBe(1.5)
    expect(r.status).toBe('warning') // 45200 > 8000 triggers warning
  })

  it('converts used_memory bytes to MB correctly', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockStats({
      used_memory: 134217728, // exactly 128 MB
    }))
    const r = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(r.memoryUsedMb).toBe(128)
  })

  it('calculates memoryPercent correctly (128MB of 256MB = 50%)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockStats({
      used_memory: 134217728,   // 128 MB
      maxmemory: 268435456,     // 256 MB
    }))
    const r = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(r.memoryPercent).toBe(50)
  })

  it('calculates hit rate correctly (800 hits, 200 misses = 80%)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockStats({
      keyspace_hits: 800,
      keyspace_misses: 200,
    }))
    const r = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(r.hitRate).toBe(80)
  })

  it('returns unknown on API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response)
    const r = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(r.status).toBe('unknown')
    expect(r.dailyCommands).toBeNull()
    expect(r.memoryUsedMb).toBeNull()
    expect(r.connections).toBeNull()
    expect(r.throughput).toBeNull()
  })

  it('memoryLimitMb is null when maxmemory === 0', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockStats({
      used_memory: 134217728,
      maxmemory: 0,
    }))
    const r = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(r.memoryLimitMb).toBeNull()
    expect(r.memoryPercent).toBe(0)
  })

  it('avgLatencyMs converts usec to ms (1000 usec = 1 ms)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockStats({
      avg_latency_usec: 1000,
    }))
    const r = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(r.avgLatencyMs).toBe(1)
  })
})

