import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return email channel using account email
  return NextResponse.json({
    channels: [{
      type: 'email',
      config: { email: user.email },
      isDefault: true,
    }]
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type: channelType } = body

  const { limits } = await getUserPlan(user.id)
  if (!limits.channels.includes(channelType)) {
    return NextResponse.json(
      { error: `Channel type "${channelType}" not available on your plan.` },
      { status: 403 },
    )
  }

  return NextResponse.json({ ok: true })
}
