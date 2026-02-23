import { describe, it, expect } from 'vitest'
import {
  groupByProvider,
  computeGroupStatus,
  pickKeyMetrics,
  formatAlertTitle,
  timeAgo,
} from '../helpers'

// ── timeAgo ──────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  it('returns "just now" for < 1 min', () => {
    const recent = new Date(Date.now() - 30_000).toISOString()
    expect(timeAgo(recent)).toBe('just now')
  })
  it('returns "X min ago" for < 60 min', () => {
    const past = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(timeAgo(past)).toBe('5 min ago')
  })
  it('returns "Xh ago" for < 24h', () => {
    const past = new Date(Date.now() - 3 * 60 * 60_000).toISOString()
    expect(timeAgo(past)).toBe('3h ago')
  })
  it('returns "Xd ago" for >= 24h', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    expect(timeAgo(past)).toBe('2d ago')
  })
})

// ── groupByProvider ──────────────────────────────────────────────────────────

type MockService = { id: string; providerId: string; label: string; status: string }

describe('groupByProvider', () => {
  it('returns single service as standalone (not grouped)', () => {
    const services = [{ id: 's1', providerId: 'github', label: 'GitHub', status: 'healthy' }]
    const groups = groupByProvider(services as never)
    expect(groups).toHaveLength(1)
    expect(groups[0].isGroup).toBe(false)
    expect(groups[0].services).toHaveLength(1)
  })

  it('groups multiple services with same providerId', () => {
    const services: MockService[] = [
      { id: 's1', providerId: 'supabase', label: 'prod', status: 'healthy' },
      { id: 's2', providerId: 'supabase', label: 'staging', status: 'warning' },
      { id: 's3', providerId: 'github',   label: 'GitHub', status: 'healthy' },
    ]
    const groups = groupByProvider(services as never)
    expect(groups).toHaveLength(2)

    const supGroup = groups.find((g) => g.providerId === 'supabase')!
    expect(supGroup.isGroup).toBe(true)
    expect(supGroup.services).toHaveLength(2)

    const ghGroup = groups.find((g) => g.providerId === 'github')!
    expect(ghGroup.isGroup).toBe(false)
  })

  it('preserves insertion order (first seen provider first)', () => {
    const services: MockService[] = [
      { id: 's1', providerId: 'stripe', label: 'Stripe', status: 'healthy' },
      { id: 's2', providerId: 'github', label: 'GitHub', status: 'healthy' },
    ]
    const groups = groupByProvider(services as never)
    expect(groups[0].providerId).toBe('stripe')
    expect(groups[1].providerId).toBe('github')
  })
})

// ── computeGroupStatus ────────────────────────────────────────────────────────

describe('computeGroupStatus', () => {
  it('returns healthy when all healthy', () => {
    expect(computeGroupStatus(['healthy', 'healthy'])).toBe('healthy')
  })
  it('returns critical when any critical', () => {
    expect(computeGroupStatus(['healthy', 'critical', 'warning'])).toBe('critical')
  })
  it('returns warning when any warning (no critical)', () => {
    expect(computeGroupStatus(['healthy', 'warning'])).toBe('warning')
  })
  it('returns unknown when no statuses', () => {
    expect(computeGroupStatus([])).toBe('unknown')
  })
})

// ── pickKeyMetrics ────────────────────────────────────────────────────────────

type MockCollector = { id: string; name: string; snapshot: { value: number | null; value_text: string | null; unit: string | null; status: string; fetched_at: string } | null }

describe('pickKeyMetrics', () => {
  const makeCollector = (id: string, value: number | null): MockCollector => ({
    id,
    name: id,
    snapshot: value !== null ? { value, value_text: null, unit: null, status: 'healthy', fetched_at: new Date().toISOString() } : null,
  })

  it('returns up to max collectors with snapshots', () => {
    const collectors = [
      makeCollector('a', 1),
      makeCollector('b', 2),
      makeCollector('c', 3),
      makeCollector('d', 4),
    ]
    const result = pickKeyMetrics(collectors as never, 3)
    expect(result).toHaveLength(3)
  })

  it('excludes collectors with null snapshot', () => {
    const collectors = [
      makeCollector('a', null),
      makeCollector('b', 2),
      makeCollector('c', 3),
    ]
    const result = pickKeyMetrics(collectors as never, 3)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('returns empty array when no collectors have snapshots', () => {
    const collectors = [makeCollector('a', null)]
    expect(pickKeyMetrics(collectors as never, 3)).toHaveLength(0)
  })
})

// ── formatAlertTitle ─────────────────────────────────────────────────────────

describe('formatAlertTitle', () => {
  it('formats gt condition', () => {
    expect(formatAlertTitle('Sentry', 'error_count', 'gt', 100)).toBe(
      'Sentry error_count exceeded threshold (>100)'
    )
  })
  it('formats lt condition', () => {
    expect(formatAlertTitle('OpenAI', 'credit_balance', 'lt', 5)).toBe(
      'OpenAI credit_balance below threshold (<5)'
    )
  })
  it('formats eq condition', () => {
    expect(formatAlertTitle('GitHub', 'rate_limit_remaining', 'eq', 0)).toBe(
      'GitHub rate_limit_remaining equals threshold (=0)'
    )
  })
  it('handles null threshold', () => {
    expect(formatAlertTitle('Stripe', 'account_balance', 'gt', null)).toBe(
      'Stripe account_balance exceeded threshold'
    )
  })
})
