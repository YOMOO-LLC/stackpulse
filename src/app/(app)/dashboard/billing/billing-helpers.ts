import type { Plan } from '@/lib/subscription'

export interface SubscriptionInfo {
  plan: Plan
  billing_cycle: string | null
  current_period_end: string | null
  ls_customer_id: string | null
  ls_subscription_id: string | null
}

const PLAN_DISPLAY_NAMES: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
}

export function getPlanDisplayName(plan: Plan): string {
  return PLAN_DISPLAY_NAMES[plan] ?? 'Free'
}

export function formatBillingCycle(cycle: string | null): string {
  if (!cycle) return ''
  return cycle === 'yearly' ? 'Yearly' : 'Monthly'
}

export function formatPeriodEnd(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function isPaidPlan(plan: Plan): boolean {
  return plan !== 'free'
}

export function getCustomerPortalUrl(customerId: string | null): string | null {
  if (!customerId) return null
  return `https://app.lemonsqueezy.com/my-orders`
}

export function getVariantIdForPlan(
  plan: 'pro' | 'business',
  cycle: 'monthly' | 'yearly',
): string | null {
  const envMap: Record<string, string | undefined> = {
    'pro-monthly': process.env.LS_PRO_MONTHLY_VARIANT_ID,
    'pro-yearly': process.env.LS_PRO_YEARLY_VARIANT_ID,
    'business-monthly': process.env.LS_BUSINESS_MONTHLY_VARIANT_ID,
    'business-yearly': process.env.LS_BUSINESS_YEARLY_VARIANT_ID,
  }
  return envMap[`${plan}-${cycle}`] ?? null
}
