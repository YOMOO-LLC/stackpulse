import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppSidebar } from '../app-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/svc-123',
}))

const services = [
  { id: 'svc-123', label: 'My OpenRouter', providerId: 'openrouter', status: 'healthy' as const },
  { id: 'svc-456', label: 'My Resend', providerId: 'resend', status: 'unknown' as const },
]

describe('AppSidebar service links', () => {
  it('links each service to its detail page', () => {
    render(<AppSidebar services={services} userEmail="dev@test.com" />)
    const links = screen.getAllByRole('link')
    const serviceLinks = links.filter((l) => {
      const href = l.getAttribute('href')
      return href?.startsWith('/dashboard/svc-')
    })
    expect(serviceLinks).toHaveLength(2)
    expect(serviceLinks[0].getAttribute('href')).toBe('/dashboard/svc-123')
    expect(serviceLinks[1].getAttribute('href')).toBe('/dashboard/svc-456')
  })

  it('marks the active service with active styling', () => {
    const { container } = render(<AppSidebar services={services} userEmail="dev@test.com" />)
    const activeLink = container.querySelector('a[href="/dashboard/svc-123"]')
    expect(activeLink?.className).toContain('bg-secondary')
  })

  it('does not mark inactive service as active', () => {
    const { container } = render(<AppSidebar services={services} userEmail="dev@test.com" />)
    const inactiveLink = container.querySelector('a[href="/dashboard/svc-456"]')
    // Use regex to match standalone 'bg-secondary' (not 'bg-secondary/60' etc.)
    expect(inactiveLink?.className).not.toMatch(/\bbg-secondary\b(?!\/)/)
  })
})
