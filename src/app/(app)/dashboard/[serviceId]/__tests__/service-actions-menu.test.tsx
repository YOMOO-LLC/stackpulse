import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ServiceActionsMenu } from '../service-actions-menu'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

global.fetch = vi.fn()

describe('ServiceActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the trigger button', () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('opens dropdown with Rename and Delete service items on trigger click', async () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    const trigger = screen.getByRole('button')
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeTruthy()
      expect(screen.getByText('Delete service')).toBeTruthy()
    })
  })

  it('opens rename dialog pre-filled with currentLabel', async () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Rename'))
    fireEvent.click(screen.getByText('Rename'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
      const input = screen.getByRole('textbox')
      expect((input as HTMLInputElement).value).toBe('My Service')
    })
  })

  it('calls PATCH on rename submit and refreshes router', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'svc-1', label: 'New Name' }),
    } as Response)
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Rename'))
    fireEvent.click(screen.getByText('Rename'))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/services/svc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'New Name' }),
      })
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('opens delete confirmation dialog on Delete service click', async () => {
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Delete service'))
    fireEvent.click(screen.getByText('Delete service'))
    await waitFor(() => {
      expect(screen.getByText('Delete service?')).toBeTruthy()
    })
  })

  it('calls DELETE and navigates to /dashboard on delete confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response)
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Delete service'))
    fireEvent.click(screen.getByText('Delete service'))
    await waitFor(() => screen.getByText('Delete service?'))
    fireEvent.click(screen.getByRole('button', { name: /delete service/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/services/svc-1', { method: 'DELETE' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('resets rename loading state on fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Rename'))
    fireEvent.click(screen.getByText('Rename'))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy()
      // Dialog stays open (not closed on error)
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  it('resets delete loading state on fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)
    render(<ServiceActionsMenu serviceId="svc-1" currentLabel="My Service" />)
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await waitFor(() => screen.getByText('Delete service'))
    fireEvent.click(screen.getByText('Delete service'))
    await waitFor(() => screen.getByText('Delete service?'))
    fireEvent.click(screen.getByRole('button', { name: /delete service/i }))
    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy()
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })
})
