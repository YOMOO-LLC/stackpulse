import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusDot } from '../status-dot'

describe('StatusDot', () => {
  it('renders healthy status with emerald color class', () => {
    const { container } = render(<StatusDot status="healthy" />)
    const dot = container.querySelector('.bg-emerald-500')
    expect(dot).toBeTruthy()
  })

  it('renders warning status with amber color class', () => {
    const { container } = render(<StatusDot status="warning" />)
    const dot = container.querySelector('.bg-amber-500')
    expect(dot).toBeTruthy()
  })

  it('renders critical status with red color class', () => {
    const { container } = render(<StatusDot status="critical" />)
    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeTruthy()
  })

  it('renders label when showLabel is true', () => {
    render(<StatusDot status="healthy" showLabel />)
    expect(screen.getByText('正常')).toBeTruthy()
  })

  it('renders ping animation for healthy and warning', () => {
    const { container } = render(<StatusDot status="healthy" />)
    const ping = container.querySelector('.animate-ping')
    expect(ping).toBeTruthy()
  })

  it('does not render ping animation for critical', () => {
    const { container } = render(<StatusDot status="critical" />)
    const ping = container.querySelector('.animate-ping')
    expect(ping).toBeNull()
  })
})
