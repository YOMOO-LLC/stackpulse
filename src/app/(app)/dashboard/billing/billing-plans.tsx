'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CheckoutButton, SwitchPlanButton } from './checkout-button'

type BillingPeriod = 'monthly' | 'yearly'

interface PlanConfig {
  name: string
  key: string
  monthly: string
  yearly: string
  period: { monthly: string; yearly: string }
  highlighted: boolean
  badge?: string
  features: string[]
}

const PLANS: PlanConfig[] = [
  {
    name: 'Free',
    key: 'free',
    monthly: '$0',
    yearly: '$0',
    period: { monthly: '/forever', yearly: '/forever' },
    highlighted: false,
    features: [
      '3 services',
      'Hourly polling',
      '3 alert rules',
      'Email notifications',
      '7-day retention',
    ],
  },
  {
    name: 'Pro',
    key: 'pro',
    monthly: '$4.99',
    yearly: '$49.99',
    period: { monthly: '/mo', yearly: '/yr' },
    highlighted: true,
    badge: 'Popular',
    features: [
      '15 services',
      '15min polling',
      '3 team members',
      '20 alert rules',
      'Email + Slack',
      '30-day retention',
    ],
  },
  {
    name: 'Business',
    key: 'business',
    monthly: '$19.99',
    yearly: '$199.99',
    period: { monthly: '/mo', yearly: '/yr' },
    highlighted: false,
    features: [
      'Unlimited services',
      '5min polling',
      '10 team members',
      'Unlimited alert rules',
      'All channels',
      '90-day retention',
    ],
  },
]

interface VariantIds {
  proMonthly: string | null
  proYearly: string | null
  businessMonthly: string | null
  businessYearly: string | null
}

interface BillingPlansProps {
  currentPlan: string
  variantIds: VariantIds
  hasSubscription: boolean
}

export function BillingPlans({ currentPlan, variantIds, hasSubscription }: BillingPlansProps) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')

  function getVariantId(planKey: string): string | null {
    if (planKey === 'pro') return period === 'monthly' ? variantIds.proMonthly : variantIds.proYearly
    if (planKey === 'business') return period === 'monthly' ? variantIds.businessMonthly : variantIds.businessYearly
    return null
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Toggle */}
      <div
        className="flex items-center rounded-full p-1 mb-10"
        style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setPeriod('monthly')}
          className="px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            background: period === 'monthly' ? 'var(--primary)' : 'transparent',
            color: period === 'monthly' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
          }}
        >
          Monthly
        </button>
        <button
          onClick={() => setPeriod('yearly')}
          className="px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            background: period === 'yearly' ? 'var(--primary)' : 'transparent',
            color: period === 'yearly' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
          }}
        >
          Yearly
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.key
          const price = plan[period]
          const suffix = plan.period[period]
          const showSaveBadge = period === 'yearly' && plan.key !== 'free'

          return (
            <div
              key={plan.name}
              className="relative flex flex-col rounded-xl p-6"
              style={{
                background: 'var(--card)',
                border: plan.highlighted
                  ? '2px solid var(--primary)'
                  : '1px solid var(--border)',
              }}
            >
              {plan.highlighted && plan.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-0.5 rounded-full"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {plan.badge}
                </span>
              )}

              <h3
                className="text-lg font-semibold mb-1"
                style={{ color: 'var(--foreground)' }}
              >
                {plan.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-6">
                <span
                  className="text-4xl font-bold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {price}
                </span>
                <span
                  className="text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {suffix}
                </span>
                {showSaveBadge && (
                  <span
                    className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--sp-success-muted)',
                      color: 'var(--primary)',
                    }}
                  >
                    Save 17%
                  </span>
                )}
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Check
                      className="size-4 flex-shrink-0"
                      style={{ color: 'var(--primary)' }}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : plan.key === 'free' ? (
                <Button variant="outline" className="w-full" disabled>
                  Free
                </Button>
              ) : hasSubscription ? (
                <SwitchPlanButton
                  variantId={getVariantId(plan.key)}
                  label={`Switch to ${plan.name}`}
                  highlighted={plan.highlighted}
                  currentPlan={currentPlan}
                />
              ) : (
                <CheckoutButton
                  variantId={getVariantId(plan.key)}
                  label={`Upgrade to ${plan.name}`}
                  highlighted={plan.highlighted}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
