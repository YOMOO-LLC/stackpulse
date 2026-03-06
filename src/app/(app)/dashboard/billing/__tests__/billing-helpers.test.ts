import { describe, it, expect } from 'vitest'
import {
  getPlanDisplayName,
  formatBillingCycle,
  formatPeriodEnd,
  isPaidPlan,
  getCustomerPortalUrl,
} from '../billing-helpers'

describe('getPlanDisplayName', () => {
  it('returns Free for free plan', () => {
    expect(getPlanDisplayName('free')).toBe('Free')
  })

  it('returns Pro for pro plan', () => {
    expect(getPlanDisplayName('pro')).toBe('Pro')
  })

  it('returns Business for business plan', () => {
    expect(getPlanDisplayName('business')).toBe('Business')
  })
})

describe('formatBillingCycle', () => {
  it('returns Monthly for monthly cycle', () => {
    expect(formatBillingCycle('monthly')).toBe('Monthly')
  })

  it('returns Yearly for yearly cycle', () => {
    expect(formatBillingCycle('yearly')).toBe('Yearly')
  })

  it('returns empty string for null', () => {
    expect(formatBillingCycle(null)).toBe('')
  })
})

describe('formatPeriodEnd', () => {
  it('formats a valid date string', () => {
    const result = formatPeriodEnd('2026-04-01T00:00:00Z')
    expect(result).toBe('April 1, 2026')
  })

  it('returns empty string for null', () => {
    expect(formatPeriodEnd(null)).toBe('')
  })

  it('returns empty string for invalid date', () => {
    expect(formatPeriodEnd('not-a-date')).toBe('')
  })
})

describe('isPaidPlan', () => {
  it('returns false for free plan', () => {
    expect(isPaidPlan('free')).toBe(false)
  })

  it('returns true for pro plan', () => {
    expect(isPaidPlan('pro')).toBe(true)
  })

  it('returns true for business plan', () => {
    expect(isPaidPlan('business')).toBe(true)
  })
})

describe('getCustomerPortalUrl', () => {
  it('returns Lemon Squeezy orders URL for a customer with ID', () => {
    const url = getCustomerPortalUrl('cust_123')
    expect(url).toBe('https://app.lemonsqueezy.com/my-orders')
  })

  it('returns null when customerId is null', () => {
    expect(getCustomerPortalUrl(null)).toBeNull()
  })
})
