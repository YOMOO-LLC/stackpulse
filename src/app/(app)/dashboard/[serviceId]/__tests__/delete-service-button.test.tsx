import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteServiceButton } from '../delete-service-button'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

global.fetch = vi.fn()

describe('DeleteServiceButton', () => {
  it('renders a button', () => {
    render(<DeleteServiceButton serviceId="svc-1" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('opens dialog on click', () => {
    render(<DeleteServiceButton serviceId="svc-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Delete service?')).toBeTruthy()
  })

  it('calls DELETE API and redirects on confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response)
    render(<DeleteServiceButton serviceId="svc-1" />)
    fireEvent.click(screen.getByRole('button'))
    const deleteBtn = screen.getByText('Delete service')
    fireEvent.click(deleteBtn)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/services/svc-1', { method: 'DELETE' })
    })
  })
})
