import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DemoBanner } from '../demo-banner'

// Mock fetch globally
global.fetch = vi.fn()

describe('DemoBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders demo mode text and Reset Now button', () => {
    render(<DemoBanner />)
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('hides after clicking Dismiss', () => {
    render(<DemoBanner />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument()
  })

  it('calls /api/demo/reset on Reset Now click', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, reset_at: '2026-02-23T00:00:00Z' }),
    } as any)

    render(<DemoBanner />)
    fireEvent.click(screen.getByRole('button', { name: /reset now/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/demo/reset', expect.objectContaining({
        method: 'POST',
      }))
    })
  })

  it('shows "Resetting..." while request is pending', async () => {
    let resolve: (v: unknown) => void
    vi.mocked(global.fetch).mockReturnValueOnce(
      new Promise((r) => { resolve = r }) as any
    )

    render(<DemoBanner />)
    fireEvent.click(screen.getByRole('button', { name: /reset now/i }))
    expect(screen.getByText(/resetting/i)).toBeInTheDocument()

    resolve!({ ok: true, json: async () => ({ ok: true }) })
    await waitFor(() => expect(screen.queryByText(/resetting/i)).not.toBeInTheDocument())
  })
})
