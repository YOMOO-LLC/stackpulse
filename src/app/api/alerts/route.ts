import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('serviceId')
  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('alert_configs')
    .select('id, connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled, created_at')
    .eq('connected_service_id', serviceId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled } = body

  if (!connected_service_id || !collector_id || !condition) {
    return NextResponse.json(
      { error: 'connected_service_id, collector_id, and condition are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('alert_configs')
    .insert({
      user_id: user.id,
      connected_service_id,
      collector_id,
      condition,
      threshold_numeric: threshold_numeric ?? null,
      threshold_text: threshold_text ?? null,
      enabled: enabled ?? true,
    })
    .select('id, connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
