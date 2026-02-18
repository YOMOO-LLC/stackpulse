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
    expect(screen.getByText('ALERT RULES')).toBeTruthy()
  })

  it('shows Add alert rule button', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    expect(screen.getByText(/add alert rule/i)).toBeTruthy()
  })

  it('shows form when Add alert rule is clicked', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    fireEvent.click(screen.getByText(/add alert rule/i))
    expect(screen.getByText(/metric/i)).toBeTruthy()
  })

  it('shows preset buttons in form', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    fireEvent.click(screen.getByText(/add alert rule/i))
    expect(screen.getByText('Low Credits')).toBeTruthy()
  })
})
