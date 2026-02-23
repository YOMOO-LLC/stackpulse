import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// Polyfill for Radix UI DropdownMenu in jsdom
class MockPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string
  constructor(type: string, init?: MouseEventInit & { pointerId?: number; pointerType?: string }) {
    super(type, init)
    this.pointerId = init?.pointerId ?? 0
    this.pointerType = init?.pointerType ?? 'mouse'
  }
}
// @ts-expect-error jsdom override
window.PointerEvent = MockPointerEvent
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: vi.fn(),
  setPointerCapture: vi.fn(),
  releasePointerCapture: vi.fn(),
})
