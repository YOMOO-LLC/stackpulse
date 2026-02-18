import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EventsSection } from '../events-section'

global.fetch = vi.fn()

const mockEvents = [
  {
    id: 'evt-1',
    notified_at: '2026-02-17T14:32:00Z',
    triggered_value_numeric: 4.20,
    triggered_value_text: null,
    alert_configs: { collector_id: 'credit_balance', condition: 'lt', threshold_numeric: 5 },
  },
]

describe('EventsSection', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: mockEvents, hasMore: false }),
    } as Response)
  })

  it('renders section heading', () => {
    render(<EventsSection serviceId="svc-1" />)
    expect(screen.getByText('RECENT EVENTS')).toBeTruthy()
  })

  it('shows events after loading', async () => {
    render(<EventsSection serviceId="svc-1" />)
    await waitFor(() => {
      expect(screen.getByText('$4.20')).toBeTruthy()
    })
  })

  it('shows empty state when no events', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: [], hasMore: false }),
    } as Response)
    render(<EventsSection serviceId="svc-1" />)
    await waitFor(() => {
      expect(screen.getByText(/no alerts have triggered/i)).toBeTruthy()
    })
  })
})
