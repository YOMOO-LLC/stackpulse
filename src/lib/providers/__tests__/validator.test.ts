import { describe, it, expect } from 'vitest'
import { validateProvider } from '../validator'
import type { ServiceProvider, MetricType } from '../types'

function makeValidProvider(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'ai',
    icon: '/icons/openrouter.svg',
    authType: 'api_key',
    credentials: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
    collectors: [
      {
        id: 'credits',
        name: 'Credits Remaining',
        metricType: 'currency',
        unit: 'USD',
        refreshInterval: 300,
        endpoint: '/api/v1/credits',
      },
    ],
    alerts: [
      {
        id: 'low-credits',
        name: 'Low Credits',
        collectorId: 'credits',
        condition: 'lt',
        defaultThreshold: 5,
        message: 'Credits below {threshold}',
      },
    ],
    ...overrides,
  }
}

describe('validateProvider', () => {
  it('should accept a valid provider definition', () => {
    const result = validateProvider(makeValidProvider())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject a provider with empty id', () => {
    const result = validateProvider(makeValidProvider({ id: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'id' })
    )
  })

  it('should reject a provider with no collectors', () => {
    const result = validateProvider(makeValidProvider({ collectors: [] }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'collectors' })
    )
  })

  it('should reject a collector with refreshInterval < 60', () => {
    const result = validateProvider(
      makeValidProvider({
        collectors: [
          {
            id: 'fast',
            name: 'Too Fast',
            metricType: 'count',
            unit: '',
            refreshInterval: 30,
            endpoint: '/api/fast',
          },
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'collectors[0].refreshInterval' })
    )
  })

  it('should reject a collector with invalid metricType', () => {
    const result = validateProvider(
      makeValidProvider({
        collectors: [
          {
            id: 'bad-type',
            name: 'Bad Type',
            metricType: 'invalid' as unknown as MetricType,
            unit: '',
            refreshInterval: 120,
            endpoint: '/api/bad',
          },
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'collectors[0].metricType' })
    )
  })
})
