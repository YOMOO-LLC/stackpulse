import { describe, it, expect } from 'vitest'
import { checkThreshold, evaluateAlerts } from './engine'
import type { AlertCondition } from '@/lib/providers/types'

describe('checkThreshold', () => {
  const cases: Array<[AlertCondition, number | string, number | string, boolean]> = [
    ['lt', 10, 5, true],
    ['lt', 10, 15, false],
    ['lt', 10, 10, false],
    ['gt', 8000, 9000, true],
    ['gt', 8000, 7999, false],
    ['eq', 'critical', 'critical', true],
    ['eq', 'critical', 'healthy', false],
    ['status_is', 'critical', 'critical', true],
    ['status_is', 'critical', 'healthy', false],
  ]

  it.each(cases)(
    'condition=%s threshold=%s value=%s → shouldAlert=%s',
    (condition, threshold, value, expected) => {
      expect(checkThreshold(condition, threshold, value)).toBe(expected)
    }
  )
})

const baseRule = {
  id: 'rule-1',
  collector_id: 'credit_balance',
  condition: 'lt' as const,
  threshold_numeric: 5,
  threshold_text: null,
  enabled: true,
  last_notified_at: null,
}

describe('evaluateAlerts', () => {
  it('returns triggered rules when threshold crossed', () => {
    const triggered = evaluateAlerts(
      [baseRule],
      { collectorId: 'credit_balance', value: 3.5, status: 'healthy' }
    )
    expect(triggered).toHaveLength(1)
    expect(triggered[0].id).toBe('rule-1')
  })

  it('returns empty when threshold not crossed', () => {
    const triggered = evaluateAlerts(
      [baseRule],
      { collectorId: 'credit_balance', value: 8, status: 'healthy' }
    )
    expect(triggered).toHaveLength(0)
  })

  it('skips disabled rules', () => {
    const triggered = evaluateAlerts(
      [{ ...baseRule, enabled: false }],
      { collectorId: 'credit_balance', value: 3.5, status: 'healthy' }
    )
    expect(triggered).toHaveLength(0)
  })

  it('skips rules for different collector', () => {
    const triggered = evaluateAlerts(
      [{ ...baseRule, collector_id: 'other_metric' }],
      { collectorId: 'credit_balance', value: 3.5, status: 'healthy' }
    )
    expect(triggered).toHaveLength(0)
  })

  it('respects 1-hour cooldown', () => {
    const recentlyNotified = {
      ...baseRule,
      last_notified_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    }
    const triggered = evaluateAlerts(
      [recentlyNotified],
      { collectorId: 'credit_balance', value: 3.5, status: 'healthy' }
    )
    expect(triggered).toHaveLength(0)
  })

  it('fires again after cooldown expires', () => {
    const oldNotification = {
      ...baseRule,
      last_notified_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    }
    const triggered = evaluateAlerts(
      [oldNotification],
      { collectorId: 'credit_balance', value: 3.5, status: 'healthy' }
    )
    expect(triggered).toHaveLength(1)
  })
})
