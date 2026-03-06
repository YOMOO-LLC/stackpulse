import { describe, it, expect } from 'vitest'
import { formatUsage, isAtLimit, getAddServiceAction } from '../plan-helpers'

describe('formatUsage', () => {
  it('shows count/max when max is finite', () => {
    expect(formatUsage(3, 3)).toBe('3/3')
    expect(formatUsage(7, 15)).toBe('7/15')
  })

  it('shows only count when max is Infinity', () => {
    expect(formatUsage(5, Infinity)).toBe('5')
  })

  it('shows 0/max for zero count', () => {
    expect(formatUsage(0, 3)).toBe('0/3')
  })
})

describe('isAtLimit', () => {
  it('returns true when count equals max', () => {
    expect(isAtLimit(3, 3)).toBe(true)
  })

  it('returns true when count exceeds max', () => {
    expect(isAtLimit(4, 3)).toBe(true)
  })

  it('returns false when count is below max', () => {
    expect(isAtLimit(2, 3)).toBe(false)
  })

  it('returns false when max is Infinity', () => {
    expect(isAtLimit(100, Infinity)).toBe(false)
  })
})

describe('getAddServiceAction', () => {
  it('returns connect action when below limit', () => {
    const action = getAddServiceAction(2, 3)
    expect(action.label).toBe('Add Service')
    expect(action.href).toBe('/connect')
    expect(action.isUpgrade).toBe(false)
  })

  it('returns upgrade action when at limit', () => {
    const action = getAddServiceAction(3, 3)
    expect(action.label).toBe('Upgrade to Add More')
    expect(action.href).toBe('/dashboard/billing')
    expect(action.isUpgrade).toBe(true)
  })

  it('returns connect action when max is Infinity', () => {
    const action = getAddServiceAction(50, Infinity)
    expect(action.label).toBe('Add Service')
    expect(action.href).toBe('/connect')
    expect(action.isUpgrade).toBe(false)
  })
})
