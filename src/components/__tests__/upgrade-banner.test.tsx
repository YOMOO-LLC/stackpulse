import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpgradeBanner } from '../upgrade-banner'

describe('UpgradeBanner', () => {
  it('renders the plan name in the success message', () => {
    render(<UpgradeBanner planName="Pro" />)
    expect(screen.getByText(/Welcome to Pro!/)).toBeInTheDocument()
    expect(screen.getByText(/Your plan has been upgraded/)).toBeInTheDocument()
  })

  it('renders a dismiss button', () => {
    render(<UpgradeBanner planName="Business" />)
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('hides the banner when dismiss is clicked', () => {
    render(<UpgradeBanner planName="Pro" />)
    const dismiss = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismiss)
    expect(screen.queryByText(/Welcome to Pro!/)).not.toBeInTheDocument()
  })
})
