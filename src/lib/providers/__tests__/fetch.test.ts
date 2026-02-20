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
