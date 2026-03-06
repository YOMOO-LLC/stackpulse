import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FaqSection } from '../faq-section'

const EXPECTED_QUESTIONS = [
  'What is StackPulse?',
  'How does StackPulse work?',
  'Is StackPulse free?',
  'How fast are alerts?',
  'Is my data secure?',
  'What providers do you support?',
  'Can I cancel anytime?',
]

describe('FaqSection', () => {
  it('renders the FAQ section heading', () => {
    render(<FaqSection />)
    expect(screen.getByText('Frequently Asked Questions')).toBeTruthy()
  })

  it('renders all FAQ questions', () => {
    render(<FaqSection />)
    for (const question of EXPECTED_QUESTIONS) {
      expect(screen.getByText(question)).toBeTruthy()
    }
  })

  it('answers are hidden by default', () => {
    render(<FaqSection />)
    // All answer panels should not be visible initially
    const buttons = screen.getAllByRole('button')
    const faqButtons = buttons.filter((btn) =>
      EXPECTED_QUESTIONS.some((q) => btn.textContent?.includes(q))
    )
    expect(faqButtons.length).toBe(EXPECTED_QUESTIONS.length)
  })

  it('clicking a question reveals its answer', () => {
    render(<FaqSection />)
    const firstQuestion = screen.getByText(EXPECTED_QUESTIONS[0])
    const button = firstQuestion.closest('button')!
    fireEvent.click(button)
    // After clicking, the answer panel should be visible
    const panel = button.parentElement?.querySelector('[data-faq-answer]')
    expect(panel).toBeTruthy()
    // The panel's max-height should allow content to show
    expect(panel?.classList.contains('max-h-0')).toBe(false)
  })

  it('clicking the same question again hides the answer', () => {
    render(<FaqSection />)
    const firstQuestion = screen.getByText(EXPECTED_QUESTIONS[0])
    const button = firstQuestion.closest('button')!
    fireEvent.click(button) // open
    fireEvent.click(button) // close
    const panel = button.parentElement?.querySelector('[data-faq-answer]')
    expect(panel?.classList.contains('max-h-0')).toBe(true)
  })
})
