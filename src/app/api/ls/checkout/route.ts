import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { configureLemonSqueezy, createCheckout } from '@/lib/lemonsqueezy'

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

  configureLemonSqueezy()

  const storeId = process.env.LEMONSQUEEZY_STORE_ID!
  const checkout = await createCheckout(storeId, variantId, {
    checkoutData: {
      email: user.email,
      custom: { user_id: user.id },
    },
    productOptions: {
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'}/dashboard?upgraded=true`,
    },
  })

  const url = checkout.data?.data?.attributes?.url
  if (!url) {
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
