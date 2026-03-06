import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PricingSection } from '../pricing-section'

describe('PricingSection', () => {
  it('renders all three plan names', () => {
    render(<PricingSection />)
    expect(screen.getByText('Free')).toBeTruthy()
    expect(screen.getByText('Pro')).toBeTruthy()
    expect(screen.getByText('Business')).toBeTruthy()
  })

  it('defaults to monthly billing period', () => {
    render(<PricingSection />)
    expect(screen.getByText('$4.99')).toBeTruthy()
    expect(screen.getByText('$19.99')).toBeTruthy()
  })

  it('shows monthly prices with /month suffix', () => {
    render(<PricingSection />)
    const monthLabels = screen.getAllByText('/mo')
    // Pro and Business both show /mo (Free shows /forever)
    expect(monthLabels.length).toBeGreaterThanOrEqual(2)
  })

  it('switches to yearly prices when Yearly toggle is clicked', () => {
    render(<PricingSection />)
    fireEvent.click(screen.getByText('Yearly'))
    expect(screen.getByText('$49.99')).toBeTruthy()
    expect(screen.getByText('$199.99')).toBeTruthy()
  })

  it('shows /yr suffix in yearly mode', () => {
    render(<PricingSection />)
    fireEvent.click(screen.getByText('Yearly'))
    const yearLabels = screen.getAllByText('/yr')
    expect(yearLabels.length).toBeGreaterThanOrEqual(2)
  })

  it('shows Save 17% badge in yearly mode', () => {
    render(<PricingSection />)
    fireEvent.click(screen.getByText('Yearly'))
    const badges = screen.getAllByText('Save 17%')
    expect(badges.length).toBe(2) // Pro and Business
  })

  it('does not show Save 17% badge in monthly mode', () => {
    render(<PricingSection />)
    expect(screen.queryByText('Save 17%')).toBeNull()
  })

  it('Free plan always shows $0 regardless of toggle', () => {
    render(<PricingSection />)
    expect(screen.getByText('$0')).toBeTruthy()
    fireEvent.click(screen.getByText('Yearly'))
    expect(screen.getByText('$0')).toBeTruthy()
  })

  it('renders CTA buttons linking to /login', () => {
    render(<PricingSection />)
    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/login')
    })
  })

  it('shows Popular badge on Pro plan', () => {
    render(<PricingSection />)
    expect(screen.getByText('Popular')).toBeTruthy()
  })

  it('renders feature lists for all plans', () => {
    render(<PricingSection />)
    expect(screen.getByText('3 services')).toBeTruthy()
    expect(screen.getByText('15 services')).toBeTruthy()
    expect(screen.getByText('Unlimited services')).toBeTruthy()
  })

  it('shows "Current Plan" when currentPlan matches', () => {
    render(<PricingSection currentPlan="pro" />)
    expect(screen.getByText('Current Plan')).toBeTruthy()
  })

  it('does not show "Current Plan" when currentPlan does not match', () => {
    render(<PricingSection currentPlan="free" />)
    // Pro and Business should still show their CTAs
    const getStartedButtons = screen.getAllByText('Get Started')
    expect(getStartedButtons.length).toBe(2)
  })

  it('switches back to monthly when Monthly is clicked after Yearly', () => {
    render(<PricingSection />)
    fireEvent.click(screen.getByText('Yearly'))
    expect(screen.getByText('$49.99')).toBeTruthy()
    fireEvent.click(screen.getByText('Monthly'))
    expect(screen.getByText('$4.99')).toBeTruthy()
  })
})
