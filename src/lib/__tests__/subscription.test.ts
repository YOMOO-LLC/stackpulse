import { describe, it, expect } from 'vitest'
import { getPlanLimits, PLAN_LIMITS } from '../subscription'

describe('getPlanLimits', () => {
  it('returns free limits by default', () => {
    const limits = getPlanLimits('free')
    expect(limits.maxServices).toBe(3)
    expect(limits.pollCron).toBe('0 * * * *')
    expect(limits.maxAlertRules).toBe(3)
    expect(limits.maxTeamMembers).toBe(1)
    expect(limits.retentionDays).toBe(7)
  })

  it('returns pro limits', () => {
    const limits = getPlanLimits('pro')
    expect(limits.maxServices).toBe(15)
    expect(limits.pollCron).toBe('*/15 * * * *')
    expect(limits.maxAlertRules).toBe(20)
    expect(limits.maxTeamMembers).toBe(3)
    expect(limits.retentionDays).toBe(30)
  })

  it('returns business limits', () => {
    const limits = getPlanLimits('business')
    expect(limits.maxServices).toBe(Infinity)
    expect(limits.pollCron).toBe('*/5 * * * *')
    expect(limits.maxAlertRules).toBe(Infinity)
    expect(limits.maxTeamMembers).toBe(10)
    expect(limits.retentionDays).toBe(90)
  })

  it('falls back to free for unknown plan', () => {
    const limits = getPlanLimits('unknown' as any)
    expect(limits.maxServices).toBe(3)
  })
})
