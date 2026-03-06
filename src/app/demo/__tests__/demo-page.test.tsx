import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DemoPage from '../page'

describe('DemoPage', () => {
  it('renders all 4 service names', () => {
    render(<DemoPage />)
    // Use getAllByText since provider names may appear in multiple elements
    expect(screen.getAllByText('GitHub').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Stripe').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Vercel').length).toBeGreaterThanOrEqual(1)
  })

  it('displays demo banner with sample data message', () => {
    render(<DemoPage />)
    expect(screen.getByText(/this is a demo with sample data/i)).toBeTruthy()
  })

  it('contains sign up CTA links pointing to /login', () => {
    render(<DemoPage />)
    const signUpLinks = screen.getAllByRole('link', { name: /sign up free/i })
    expect(signUpLinks.length).toBeGreaterThanOrEqual(1)
    signUpLinks.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/login')
    })
  })

  it('renders stat cards with correct labels', () => {
    render(<DemoPage />)
    expect(screen.getByText('Active Services')).toBeTruthy()
    // "Healthy" appears in both stat card and service badges; verify at least the stat card
    expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Warnings')).toBeTruthy()
  })

  it('renders recent alerts section', () => {
    render(<DemoPage />)
    expect(screen.getByText(/recent alerts/i)).toBeTruthy()
  })

  it('renders bottom CTA bar with sign up prompt', () => {
    render(<DemoPage />)
    expect(screen.getByText(/ready to monitor your own apis/i)).toBeTruthy()
  })

  it('expands service detail on card click', () => {
    render(<DemoPage />)
    // Use data-testid to find the card button
    const githubCard = screen.getByTestId('service-card-github')
    fireEvent.click(githubCard)
    // Should show metric history after expanding
    expect(screen.getByText(/metric history/i)).toBeTruthy()
  })

  it('has correct metadata exports in layout', async () => {
    const mod = await import('../layout')
    expect(mod.metadata).toBeDefined()
    expect(mod.metadata.title).toBe('Demo | StackPulse')
    expect(mod.metadata.description).toContain('API monitoring demo')
  })
})
