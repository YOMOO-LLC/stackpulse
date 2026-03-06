import {
  lemonSqueezySetup,
  createCheckout,
  updateSubscription,
  type Checkout,
} from '@lemonsqueezy/lemonsqueezy.js'

export function configureLemonSqueezy() {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY!,
    onError: (error) => console.error('[LemonSqueezy]', error),
  })
}

export const VARIANT_TO_PLAN: Record<string, { plan: string; cycle: string }> = {
  [process.env.LS_PRO_MONTHLY_VARIANT_ID ?? '']: { plan: 'pro', cycle: 'monthly' },
  [process.env.LS_PRO_YEARLY_VARIANT_ID ?? '']: { plan: 'pro', cycle: 'yearly' },
  [process.env.LS_BUSINESS_MONTHLY_VARIANT_ID ?? '']: { plan: 'business', cycle: 'monthly' },
  [process.env.LS_BUSINESS_YEARLY_VARIANT_ID ?? '']: { plan: 'business', cycle: 'yearly' },
}

export { createCheckout, updateSubscription }
export type { Checkout }
