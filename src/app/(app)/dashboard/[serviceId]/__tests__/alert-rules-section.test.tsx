import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlertRulesSection } from '../alert-rules-section'
import type { Collector, AlertTemplate } from '@/lib/providers/types'

const mockCollectors: Collector[] = [
  { id: 'credit_balance', name: 'Credit Balance', metricType: 'currency', unit: 'USD', refreshInterval: 300, endpoint: '' },
]

const mockTemplates: AlertTemplate[] = [
  { id: 'low_credits', name: 'Low Credits', collectorId: 'credit_balance', condition: 'lt', defaultThreshold: 5, message: 'Credits below $5' },
]

global.fetch = vi.fn()

beforeEach(() => {
  vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response)
})

describe('AlertRulesSection', () => {
  it('renders section heading', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    expect(screen.getByText('Alert Rules')).toBeTruthy()
  })

  it('shows New Rule button', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    expect(screen.getByText('New Rule')).toBeTruthy()
  })

  it('shows form when New Rule is clicked', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    fireEvent.click(screen.getByText('New Rule'))
    expect(screen.getByText(/metric/i)).toBeTruthy()
  })

  it('shows preset buttons in form', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    fireEvent.click(screen.getByText('New Rule'))
    expect(screen.getByText('Low Credits')).toBeTruthy()
  })
})
