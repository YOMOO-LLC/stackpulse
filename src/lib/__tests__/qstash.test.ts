import { describe, it, expect, vi } from 'vitest'

vi.mock('@upstash/qstash', () => ({
  Client: class {
    schedules = {
      create: vi.fn().mockResolvedValue({ scheduleId: 'qs-abc' }),
      delete: vi.fn().mockResolvedValue({}),
    }
  },
}))

vi.mock('@/lib/subscription', () => ({
  getUserPlan: vi.fn().mockResolvedValue({
    plan: 'free',
    limits: {
      maxServices: 3,
      pollCron: '0 * * * *',
      maxAlertRules: 3,
      maxTeamMembers: 1,
      retentionDays: 7,
      channels: ['email'],
    },
  }),
}))

import { registerServiceSchedule, unregisterServiceSchedule } from '../qstash'

describe('registerServiceSchedule', () => {
  it('returns a scheduleId', async () => {
    const id = await registerServiceSchedule('svc-1', 'user-1')
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
