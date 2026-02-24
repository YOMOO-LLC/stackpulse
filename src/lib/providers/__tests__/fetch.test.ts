import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearProviders, registerProvider } from '../registry'
import { fetchProviderMetrics } from '../fetch'
import type { ServiceProvider } from '../types'

const mockProvider: ServiceProvider = {
  id: 'mock',
  name: 'Mock',
  category: 'other',
  icon: '',
  authType: 'api_key',
  credentials: [],
  collectors: [{ id: 'test_metric', name: 'Test', metricType: 'count', unit: 'units', refreshInterval: 60 }],
  alerts: [],
  fetchMetrics: vi.fn().mockResolvedValue([
    { collectorId: 'test_metric', value: 42, valueText: null, unit: 'units', status: 'healthy' },
  ]),
}

describe('fetchProviderMetrics (auto-dispatch)', () => {
  beforeEach(() => {
    clearProviders()
    registerProvider(mockProvider)
    vi.clearAllMocks()
  })

  it('calls provider.fetchMetrics with credentials', async () => {
    const creds = { apiKey: 'test-key' }
    const results = await fetchProviderMetrics('mock', creds)
    expect(mockProvider.fetchMetrics).toHaveBeenCalledWith(creds)
    expect(results).toHaveLength(1)
    expect(results[0].value).toBe(42)
  })

  it('returns empty array for unknown provider', async () => {
    const results = await fetchProviderMetrics('nonexistent', {})
    expect(results).toEqual([])
  })
})

describe('fetchProviderMetrics — demo sentinel', () => {
  beforeEach(() => {
    clearProviders()
    vi.clearAllMocks()
  })

  it('calls mockFetchMetrics when credentials.__demo__ is "true"', async () => {
    const mockFetch = vi.fn().mockResolvedValue([
      { collectorId: 'rate_limit_remaining', value: 1240, valueText: null, unit: 'requests', status: 'warning' },
    ])
    const provider: ServiceProvider = {
      id: 'github',
      name: 'GitHub',
      category: 'other',
      icon: '',
      authType: 'api_key',
      credentials: [],
      collectors: [{ id: 'rate_limit_remaining', name: 'Rate Limit', metricType: 'count', unit: 'requests', refreshInterval: 60 }],
      alerts: [],
      fetchMetrics: vi.fn(),
      mockFetchMetrics: mockFetch,
    }
    registerProvider(provider)

    const result = await fetchProviderMetrics('github', { __demo__: 'true' })

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(result[0].collectorId).toBe('rate_limit_remaining')
  })

  it('returns [] when __demo__ is true but provider has no mockFetchMetrics', async () => {
    const provider: ServiceProvider = {
      id: 'github',
      name: 'GitHub',
      category: 'other',
      icon: '',
      authType: 'api_key',
      credentials: [],
      collectors: [{ id: 'rate_limit_remaining', name: 'Rate Limit', metricType: 'count', unit: 'requests', refreshInterval: 60 }],
      alerts: [],
      fetchMetrics: vi.fn(),
      // no mockFetchMetrics
    }
    registerProvider(provider)

    const result = await fetchProviderMetrics('github', { __demo__: 'true' })
    expect(result).toEqual([])
  })

  it('calls real fetchMetrics when __demo__ is not set', async () => {
    const realFetch = vi.fn().mockResolvedValue([
      { collectorId: 'rate_limit_remaining', value: 5000, valueText: null, unit: 'requests', status: 'healthy' },
    ])
    const mockFetch = vi.fn()
    const provider: ServiceProvider = {
      id: 'github',
      name: 'GitHub',
      category: 'other',
      icon: '',
      authType: 'api_key',
      credentials: [],
      collectors: [{ id: 'rate_limit_remaining', name: 'Rate Limit', metricType: 'count', unit: 'requests', refreshInterval: 60 }],
      alerts: [],
      fetchMetrics: realFetch,
      mockFetchMetrics: mockFetch,
    }
    registerProvider(provider)

    await fetchProviderMetrics('github', { token: 'real-token' })

    expect(realFetch).toHaveBeenCalledOnce()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('fetchProviderMetrics — demo sentinel integration (real providers)', () => {
  it('github provider has mockFetchMetrics registered', async () => {
    // Import the providers index to trigger registerProvider calls
    await import('../../providers/index')
    const { getProvider } = await import('../registry')
    const provider = getProvider('github')
    expect(provider?.mockFetchMetrics).toBeDefined()
    const results = await provider!.mockFetchMetrics!()
    expect(results.some((r) => r.collectorId === 'rate_limit_remaining')).toBe(true)
  })
})
