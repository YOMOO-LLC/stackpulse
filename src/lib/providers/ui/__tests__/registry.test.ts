import { describe, it, expect } from 'vitest'
import { CUSTOM_DETAIL_VIEW_IDS } from '../registry'

describe('CUSTOM_DETAIL_VIEW_IDS', () => {
  it('is a Set', () => {
    expect(CUSTOM_DETAIL_VIEW_IDS).toBeInstanceOf(Set)
  })
})
