import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_TO_PLAN } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId = session.metadata?.userId
    if (!userId) return NextResponse.json({ error: 'No userId' }, { status: 400 })

    const sub = await stripe.subscriptions.retrieve(session.subscription)
    const priceId = sub.items.data[0]?.price.id
    const planInfo = PRICE_TO_PLAN[priceId] ?? { plan: 'pro', cycle: 'monthly' }

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      plan: planInfo.plan,
      billing_cycle: planInfo.cycle,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as any
    const priceId = sub.items.data[0]?.price.id
    const planInfo = PRICE_TO_PLAN[priceId]

    if (planInfo) {
      await supabase.from('subscriptions')
        .update({
          plan: planInfo.plan,
          billing_cycle: planInfo.cycle,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as any
    await supabase.from('subscriptions')
      .update({ plan: 'free', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
