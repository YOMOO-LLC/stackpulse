import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { VARIANT_TO_PLAN } from '@/lib/lemonsqueezy'

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const signatureHex = req.headers.get('X-Signature') ?? ''

  // Validate signature using HMAC-SHA256 with timing-safe comparison
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  // Both must be valid hex of equal length for timingSafeEqual
  const sigBuf = Buffer.from(signatureHex, 'hex')
  const hmacBuf = Buffer.from(expectedHmac, 'hex')

  if (sigBuf.length !== hmacBuf.length || !crypto.timingSafeEqual(hmacBuf, sigBuf)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  const eventName: string = payload.meta.event_name
  const userId: string | undefined = payload.meta.custom_data?.user_id
  const attrs = payload.data.attributes
  const subscriptionId = String(payload.data.id)

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
    if (!userId) {
      return NextResponse.json({ error: 'No user_id in custom_data' }, { status: 400 })
    }

    const variantId = String(attrs.variant_id)
    const planInfo = VARIANT_TO_PLAN[variantId] ?? { plan: 'pro', cycle: 'monthly' }

    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: planInfo.plan,
        billing_cycle: planInfo.cycle,
        ls_customer_id: String(attrs.customer_id),
        ls_subscription_id: subscriptionId,
        ls_variant_id: variantId,
        current_period_end: attrs.renews_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }

  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    await supabase
      .from('subscriptions')
      .update({ plan: 'free', updated_at: new Date().toISOString() })
      .eq('ls_subscription_id', subscriptionId)
  }

  return NextResponse.json({ received: true })
}
