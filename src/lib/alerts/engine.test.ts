import { describe, it, expect } from 'vitest'
import { checkThreshold } from './engine'
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
