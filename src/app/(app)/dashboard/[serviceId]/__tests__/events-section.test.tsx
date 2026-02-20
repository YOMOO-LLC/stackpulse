import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentSnapshotsPanel } from '../events-section'
import type { Collector } from '@/lib/providers/types'

const mockCollectors: Collector[] = [
  { id: 'rate_limit_remaining', name: 'Rate Limit Remaining', metricType: 'count', unit: 'requests', refreshInterval: 300, endpoint: '' },
]

const mockSnapshots = [
  { collector_id: 'rate_limit_remaining', value: 4892, value_text: null, unit: null, status: 'healthy', fetched_at: new Date().toISOString() },
  { collector_id: 'rate_limit_remaining', value: 4910, value_text: null, unit: null, status: 'healthy', fetched_at: new Date(Date.now() - 900000).toISOString() },
]

describe('RecentSnapshotsPanel', () => {
  it('renders section heading', () => {
    render(<RecentSnapshotsPanel snapshots={mockSnapshots} collectors={mockCollectors} />)
    expect(screen.getByText('Recent Metric Snapshots')).toBeTruthy()
  })

  it('shows snapshot values', () => {
    render(<RecentSnapshotsPanel snapshots={mockSnapshots} collectors={mockCollectors} />)
    expect(screen.getByText('4,892')).toBeTruthy()
  })

  it('shows collector names', () => {
    render(<RecentSnapshotsPanel snapshots={mockSnapshots} collectors={mockCollectors} />)
    expect(screen.getAllByText('Rate Limit Remaining').length).toBeGreaterThan(0)
  })

  it('shows empty state when no snapshots', () => {
    render(<RecentSnapshotsPanel snapshots={[]} collectors={[]} />)
    expect(screen.getByText(/no metric data/i)).toBeTruthy()
  })
})
