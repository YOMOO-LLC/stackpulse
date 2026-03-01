import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

export const PRICE_TO_PLAN: Record<string, { plan: string; cycle: string }> = {
  [process.env.STRIPE_PRO_MONTHLY_PRICE_ID!]: { plan: 'pro', cycle: 'monthly' },
  [process.env.STRIPE_PRO_YEARLY_PRICE_ID!]: { plan: 'pro', cycle: 'yearly' },
  [process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!]: { plan: 'business', cycle: 'monthly' },
  [process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID!]: { plan: 'business', cycle: 'yearly' },
}
