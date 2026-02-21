import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppSidebar } from '../app-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

vi.mock('@/app/(auth)/login/actions', () => ({
  signOut: vi.fn(),
}))

describe('AppSidebar', () => {
  it('renders all fixed nav items', () => {
    render(<AppSidebar userEmail="dev@test.com" />)
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Services')).toBeTruthy()
    expect(screen.getByText('Alerts')).toBeTruthy()
    expect(screen.getByText('Connect')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('shows user email in bottom section', () => {
    render(<AppSidebar userEmail="dev@test.com" />)
    expect(screen.getByText('dev@test.com')).toBeTruthy()
  })

  it('shows alert badge when alertCount > 0', () => {
    render(<AppSidebar userEmail="dev@test.com" alertCount={5} />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('does not show alert badge when alertCount is 0', () => {
    render(<AppSidebar userEmail="dev@test.com" alertCount={0} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
