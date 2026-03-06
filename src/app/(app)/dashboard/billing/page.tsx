import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/lib/subscription'
import { CreditCard, ExternalLink, Calendar, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getPlanDisplayName,
  formatBillingCycle,
  formatPeriodEnd,
  isPaidPlan,
  getCustomerPortalUrl,
} from './billing-helpers'
import { BillingPlans } from './billing-plans'

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, billing_cycle, current_period_end, ls_customer_id, ls_subscription_id')
    .eq('user_id', user!.id)
    .single()

  const plan = (subscription?.plan as Plan) ?? 'free'
  const billingCycle = subscription?.billing_cycle ?? null
  const periodEnd = subscription?.current_period_end ?? null
  const customerId = subscription?.ls_customer_id ?? null
  const paid = isPaidPlan(plan)
  const portalUrl = getCustomerPortalUrl(customerId)

  const variantIds = {
    proMonthly: process.env.LS_PRO_MONTHLY_VARIANT_ID ?? null,
    proYearly: process.env.LS_PRO_YEARLY_VARIANT_ID ?? null,
    businessMonthly: process.env.LS_BUSINESS_MONTHLY_VARIANT_ID ?? null,
    businessYearly: process.env.LS_BUSINESS_YEARLY_VARIANT_ID ?? null,
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1
        className="text-xl font-semibold mb-6"
        style={{ color: 'var(--foreground)' }}
      >
        Billing & Subscription
      </h1>

      {/* Current Plan Card */}
      <div
        className="rounded-xl p-6 mb-8"
        style={{
          background: 'var(--card)',
          border: paid ? '1px solid var(--primary)' : '1px solid var(--border)',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--sp-success-muted)',
                color: 'var(--primary)',
              }}
            >
              {paid ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {getPlanDisplayName(plan)} Plan
                </h2>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: paid
                      ? 'var(--sp-success-muted)'
                      : 'var(--muted)',
                    color: paid ? 'var(--primary)' : 'var(--muted-foreground)',
                  }}
                >
                  {paid ? 'Active' : 'Free Tier'}
                </span>
              </div>

              {paid ? (
                <div className="flex flex-col gap-1">
                  {billingCycle && (
                    <p
                      className="text-sm flex items-center gap-1.5"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Billed {formatBillingCycle(billingCycle).toLowerCase()}
                    </p>
                  )}
                  {periodEnd && (
                    <p
                      className="text-sm"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Current period ends {formatPeriodEnd(periodEnd)}
                    </p>
                  )}
                </div>
              ) : (
                <p
                  className="text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  You&apos;re on the free plan. Upgrade to unlock more services,
                  faster polling, and advanced features.
                </p>
              )}
            </div>
          </div>

          {paid && portalUrl && (
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                Manage Subscription
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="mb-4">
        <h2
          className="text-sm font-medium uppercase tracking-wider mb-6"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {paid ? 'Change Plan' : 'Upgrade Your Plan'}
        </h2>
        <BillingPlans currentPlan={plan} variantIds={variantIds} hasSubscription={!!subscription?.ls_subscription_id} />
      </div>
    </div>
  )
}
