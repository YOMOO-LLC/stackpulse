import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CheckoutButton } from '../checkout-button'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.location
const mockAssign = vi.fn()
Object.defineProperty(window, 'location', {
  value: { assign: mockAssign },
  writable: true,
})

describe('CheckoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the button with provided label', () => {
    render(<CheckoutButton variantId="123" label="Upgrade to Pro" />)
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeDefined()
  })

  it('calls checkout API and redirects on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.example.com' }),
    })

    render(<CheckoutButton variantId="var_123" label="Get Started" />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ls/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: 'var_123' }),
      })
    })

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('https://checkout.example.com')
    })
  })

  it('shows loading state while processing', async () => {
    let resolvePromise: (value: unknown) => void
    const fetchPromise = new Promise((resolve) => { resolvePromise = resolve })
    mockFetch.mockReturnValueOnce(fetchPromise)

    render(<CheckoutButton variantId="123" label="Get Started" />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))

    expect(screen.getByRole('button')).toHaveTextContent('Processing...')

    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com' }),
    })
  })

  it('is disabled when no variantId provided', () => {
    render(<CheckoutButton variantId={null} label="Get Started" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
