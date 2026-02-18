import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from '../sparkline'

describe('Sparkline', () => {
  it('renders an svg element', () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a polyline when given data', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />)
    expect(container.querySelector('polyline')).toBeTruthy()
  })

  it('renders nothing meaningful when values is empty', () => {
    const { container } = render(<Sparkline values={[]} />)
    // svg still renders but polyline has no points
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('points')).toBe('')
  })

  it('renders a single value without crash', () => {
    const { container } = render(<Sparkline values={[5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
