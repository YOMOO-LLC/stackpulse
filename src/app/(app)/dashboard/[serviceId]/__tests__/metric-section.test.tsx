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

describe('MetricSection — description tooltip', () => {
  it('shows info icon with description tooltip when collector has description', () => {
    const collectors: Collector[] = [{
      id: 'apdex', name: 'Apdex', metricType: 'count' as const,
      unit: '', refreshInterval: 300,
      description: 'User satisfaction score (0–1)',
    }]
    render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[{ collector_id: 'apdex', value: 0.85, value_text: '0.850', unit: '', status: 'healthy', fetched_at: new Date().toISOString() }]} />
    )
    const infoIcon = screen.getByTitle('User satisfaction score (0–1)')
    expect(infoIcon).toBeTruthy()
  })

  it('does not show info icon when collector has no description', () => {
    const collectors: Collector[] = [{
      id: 'count', name: 'Count', metricType: 'count' as const,
      unit: 'items', refreshInterval: 300,
    }]
    const { container } = render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[makeSnap('count', 42)]} />
    )
    expect(container.querySelector('[title]')).toBeNull()
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

  it('hides collectors with a section tag from the metric cards', () => {
    const collectors: Collector[] = [
      { id: 'balance', name: 'Balance', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
      { id: 'model_usage', name: 'Usage by Model', metricType: 'count' as const, unit: '', refreshInterval: 300, section: 'model_breakdown' },
    ]
    render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[makeSnap('balance', 10)]} />
    )
    expect(screen.getByText('Balance')).toBeTruthy()
    expect(screen.queryByText('Usage by Model')).toBeNull()
  })

  it('hides a collector card when it has no snapshots but other collectors do', () => {
    const collectors: Collector[] = [
      { id: 'credit_balance', name: 'Credit Balance', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
      { id: 'monthly_usage', name: 'Monthly Usage', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
    ]
    render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[makeSnap('monthly_usage', 12)]} />
    )
    expect(screen.getByText('Monthly Usage')).toBeTruthy()
    expect(screen.queryByText('Credit Balance')).toBeNull()
  })

  it('hides a collector card when all its snapshots have null values', () => {
    const collectors: Collector[] = [
      { id: 'credit_balance', name: 'Credit Balance', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
      { id: 'monthly_usage', name: 'Monthly Usage', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
    ]
    const nullSnap = {
      collector_id: 'credit_balance', value: null, value_text: null, unit: 'USD', status: 'healthy',
      fetched_at: new Date().toISOString(),
    }
    render(
      <MetricSection serviceId="s1" collectors={collectors}
        snapshots={[nullSnap, makeSnap('monthly_usage', 12)]} />
    )
    expect(screen.getByText('Monthly Usage')).toBeTruthy()
    expect(screen.queryByText('Credit Balance')).toBeNull()
  })

  it('still shows all collectors when none have snapshots (freshly connected)', () => {
    const collectors: Collector[] = [
      { id: 'credit_balance', name: 'Credit Balance', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
      { id: 'monthly_usage', name: 'Monthly Usage', metricType: 'currency' as const, unit: 'USD', refreshInterval: 300 },
    ]
    render(
      <MetricSection serviceId="s1" collectors={collectors} snapshots={[]} />
    )
    expect(screen.getByText('Credit Balance')).toBeTruthy()
    expect(screen.getByText('Monthly Usage')).toBeTruthy()
  })
})
