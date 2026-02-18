import { describe, it, expect, vi } from 'vitest'

vi.mock('@upstash/qstash', () => ({
  Client: class {
    schedules = {
      create: vi.fn().mockResolvedValue({ scheduleId: 'qs-abc' }),
      delete: vi.fn().mockResolvedValue({}),
    }
  },
}))

import { registerServiceSchedule, unregisterServiceSchedule } from '../qstash'

describe('registerServiceSchedule', () => {
  it('returns a scheduleId', async () => {
    const id = await registerServiceSchedule('svc-1')
    expect(id).toBe('qs-abc')
  })
})

describe('unregisterServiceSchedule', () => {
  it('calls delete without throwing', async () => {
    await expect(unregisterServiceSchedule('qs-abc')).resolves.not.toThrow()
  })

  it('is a no-op when scheduleId is null', async () => {
    await expect(unregisterServiceSchedule(null)).resolves.not.toThrow()
  })
})
