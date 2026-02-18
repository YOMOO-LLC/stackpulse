import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricSection } from '../metric-section'
import type { Collector } from '@/lib/providers/types'

// Mock recharts to avoid SSR issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  defs: () => null,
  linearGradient: () => null,
  stop: () => null,
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

describe('MetricSection', () => {
  it('renders section heading', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('METRICS')).toBeTruthy()
  })

  it('renders a card for each collector', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('Credit Balance')).toBeTruthy()
  })

  it('shows latest value formatted for currency', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('$7.93')).toBeTruthy()
  })

  it('shows empty state when no collectors', () => {
    render(<MetricSection serviceId="svc-1" collectors={[]} snapshots={[]} />)
    expect(screen.getByText(/no metrics/i)).toBeTruthy()
  })
})
