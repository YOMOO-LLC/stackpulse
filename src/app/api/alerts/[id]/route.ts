import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { condition, threshold_numeric, threshold_text, enabled } = body

  const updates: Record<string, unknown> = {}
  if (condition !== undefined) updates.condition = condition
  if (threshold_numeric !== undefined) updates.threshold_numeric = threshold_numeric
  if (threshold_text !== undefined) updates.threshold_text = threshold_text
  if (enabled !== undefined) updates.enabled = enabled

  const { data, error } = await supabase
    .from('alert_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('alert_configs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
