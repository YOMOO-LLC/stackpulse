import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

import { fetchUpstashQStashMetrics } from '../upstash-qstash'

const mockStats = (delivered: number, failed: number, limit: number) => ({
  ok: true,
  json: async () => ({ messagesDelivered: delivered, messagesFailed: failed, monthlyLimit: limit }),
} as Response)

const mockDlq = (messages: Array<Record<string, unknown>>) => ({
  ok: true,
  json: async () => ({ messages }),
} as Response)

const mockDlqError = () => ({ ok: false, status: 404, text: async () => 'Not Found' } as Response)

describe('fetchUpstashQStashMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns all 4 metrics correctly', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(500, 2, 10000))
      .mockResolvedValueOnce(mockDlq([{ id: '1' }, { id: '2' }, { id: '3' }]))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.messagesDelivered).toBe(500)
    expect(r.messagesFailed).toBe(2)
    expect(r.dlqDepth).toBe(3)
    expect(r.quotaUsed).toBe(5)
    expect(r.monthlyLimit).toBe(10000)
    expect(r.status).toBe('healthy')
  })

  it('calculates quotaUsed % correctly (8420 of 10000 = 84%)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(8420, 0, 10000))
      .mockResolvedValueOnce(mockDlq([]))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.quotaUsed).toBe(84)
  })

  it('sets dlqDepth correctly from DLQ API response', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(100, 0, 1000))
      .mockResolvedValueOnce(mockDlq([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }]))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.dlqDepth).toBe(5)
  })

  it('sets dlqDepth to null when DLQ API returns 404', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(500, 3, 1000))
      .mockResolvedValueOnce(mockDlqError())

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.dlqDepth).toBeNull()
    expect(r.messagesDelivered).toBe(500)
    expect(r.messagesFailed).toBe(3)
  })

  it('returns unknown on stats API error', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response)
      .mockResolvedValueOnce(mockDlqError())

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.status).toBe('unknown')
    expect(r.messagesDelivered).toBeNull()
    expect(r.messagesFailed).toBeNull()
    expect(r.dlqDepth).toBeNull()
    expect(r.quotaUsed).toBeNull()
    expect(r.monthlyLimit).toBeNull()
    expect(r.error).toBe('HTTP 401')
  })

  it('returns warning when quota > 90%', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(950, 0, 1000))
      .mockResolvedValueOnce(mockDlq([]))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.status).toBe('warning')
  })

  it('returns warning when failed > 5', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(100, 8, 1000))
      .mockResolvedValueOnce(mockDlq([]))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.status).toBe('warning')
  })

  it('returns warning when dlqDepth > 10', async () => {
    const manyDlq = Array.from({ length: 15 }, (_, i) => ({ id: String(i) }))
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockStats(100, 0, 1000))
      .mockResolvedValueOnce(mockDlq(manyDlq))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.status).toBe('warning')
  })

  it('returns network error on fetch throw', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network'))

    const r = await fetchUpstashQStashMetrics('token')
    expect(r.status).toBe('unknown')
    expect(r.error).toBe('Network error')
    expect(r.messagesDelivered).toBeNull()
    expect(r.dlqDepth).toBeNull()
  })
})
