import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { configureLemonSqueezy, updateSubscription } from '@/lib/lemonsqueezy'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { variantId } = await req.json()
  if (!variantId) {
    return NextResponse.json({ error: 'variantId is required' }, { status: 400 })
  }

  // Look up the user's current subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('ls_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!subscription?.ls_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
  }

  configureLemonSqueezy()

  const { error } = await updateSubscription(subscription.ls_subscription_id, {
    variantId,
    invoiceImmediately: true,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to switch plan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
