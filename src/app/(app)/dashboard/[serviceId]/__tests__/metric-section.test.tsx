import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricSection } from '../metric-section'
import type { Collector } from '@/lib/providers/types'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this },
      subscribe: function () { return this },
    }),
    removeChannel: () => {},
  }),
}))

const mockCollectors: Collector[] = [
  {
    id: 'credit_balance',
    name: 'Credit Balance',
    metricType: 'currency',
    unit: 'USD',
    refreshInterval: 300,
    endpoint: '',
  },
]

const mockSnapshots = [
  { collector_id: 'credit_balance', value: 7.93, value_text: null, unit: 'USD', status: 'healthy', fetched_at: new Date().toISOString() },
  { collector_id: 'credit_balance', value: 6.50, value_text: null, unit: 'USD', status: 'healthy', fetched_at: new Date(Date.now() - 3600000).toISOString() },
]

const makeSnap = (collector_id: string, value: number) => ({
  collector_id, value, value_text: null, unit: 'req', status: 'healthy',
  fetched_at: new Date().toISOString(),
})

describe('MetricSection — displayHint', () => {
  it('renders a progressbar when displayHint is progress', () => {
    const collectors: Collector[] = [{
      id: 'rate_limit', name: 'Rate Limit', metricType: 'count' as const,
      unit: 'req', refreshInterval: 300,
      displayHint: 'progress' as const,
      thresholds: { warning: 1000, critical: 100, direction: 'below' as const, max: 5000 },
    }]
    render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[makeSnap('rate_limit', 800)]} />
    )
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('marks value as critical when below critical threshold (direction: below)', () => {
    const collectors: Collector[] = [{
      id: 'balance', name: 'Balance', metricType: 'currency' as const,
      unit: 'USD', refreshInterval: 300,
      displayHint: 'currency' as const,
      thresholds: { warning: 100, critical: 20, direction: 'below' as const },
    }]
    const { container } = render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[makeSnap('balance', 15)]} />
    )
    expect(container.querySelector('[data-health="critical"]')).not.toBeNull()
  })

  it('marks value as warning when above warning threshold (direction: above)', () => {
    const collectors: Collector[] = [{
      id: 'memory', name: 'Memory', metricType: 'percentage' as const,
      unit: '%', refreshInterval: 300,
      displayHint: 'progress' as const,
      thresholds: { warning: 70, critical: 85, direction: 'above' as const, max: 100 },
    }]
    const { container } = render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[makeSnap('memory', 75)]} />
    )
    expect(container.querySelector('[data-health="warning"]')).not.toBeNull()
  })
})

describe('MetricSection', () => {
  it('renders a card for each collector', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('Credit Balance')).toBeTruthy()
  })

  it('shows latest value formatted for currency', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('$7.93')).toBeTruthy()
  })

  it('renders nothing when no collectors', () => {
    const { container } = render(<MetricSection serviceId="svc-1" collectors={[]} snapshots={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
