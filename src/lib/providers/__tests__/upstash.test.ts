import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchUpstashRedisMetrics } from '../upstash-redis'
import { fetchUpstashQStashMetrics } from '../upstash-qstash'

describe('fetchUpstashRedisMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns daily commands and memory usage', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          dailyrequests: 5000,
          used_memory: 50 * 1024 * 1024,
          maxmemory: 100 * 1024 * 1024,
        }
      }),
    } as Response)
    const result = await fetchUpstashRedisMetrics('email@example.com', 'apikey', 'db-id')
    expect(result.dailyCommands).toBe(5000)
    expect(result.memoryUsage).toBe(50)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when memory > 80%', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { dailyrequests: 100, used_memory: 85 * 1024 * 1024, maxmemory: 100 * 1024 * 1024 }
      }),
    } as Response)
    const result = await fetchUpstashRedisMetrics('e', 'k', 'id')
    expect(result.status).toBe('warning')
  })
})

describe('fetchUpstashQStashMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns delivered and failed counts', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        messagesDelivered: 500,
        messagesFailed: 3,
        monthlyLimit: 1000,
      }),
    } as Response)
    const result = await fetchUpstashQStashMetrics('qstash-token')
    expect(result.messagesDelivered).toBe(500)
    expect(result.messagesFailed).toBe(3)
    expect(result.quotaUsed).toBe(50)
    expect(result.status).toBe('healthy')
  })

  it('returns warning when quota > 80%', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        messagesDelivered: 850,
        messagesFailed: 0,
        monthlyLimit: 1000,
      }),
    } as Response)
    const result = await fetchUpstashQStashMetrics('token')
    expect(result.status).toBe('warning')
  })
})
