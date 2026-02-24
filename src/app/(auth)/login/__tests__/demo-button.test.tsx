import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock server actions (they use 'use server' and import supabase)
vi.mock('../actions', () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
}))

import LoginPage from '../page'

describe('LoginPage demo button', () => {
  it('renders a Try Demo link', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /try demo/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/demo')
  })
})
