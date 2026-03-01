import { createClient } from '@/lib/supabase/server'

export type Plan = 'free' | 'pro' | 'business'

export interface PlanLimits {
  maxServices: number
  pollCron: string
  maxAlertRules: number
  maxTeamMembers: number
  retentionDays: number
  channels: string[]
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxServices: 3,
    pollCron: '0 * * * *',
    maxAlertRules: 3,
    maxTeamMembers: 1,
    retentionDays: 7,
    channels: ['email'],
  },
  pro: {
    maxServices: 15,
    pollCron: '*/15 * * * *',
    maxAlertRules: 20,
    maxTeamMembers: 3,
    retentionDays: 30,
    channels: ['email', 'slack'],
  },
  business: {
    maxServices: Infinity,
    pollCron: '*/5 * * * *',
    maxAlertRules: Infinity,
    maxTeamMembers: 10,
    retentionDays: 90,
    channels: ['email', 'slack', 'webhook', 'pagerduty'],
  },
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free
}

export async function getUserPlan(userId: string): Promise<{ plan: Plan; limits: PlanLimits }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const plan = (data?.plan as Plan) ?? 'free'
  return { plan, limits: getPlanLimits(plan) }
}
