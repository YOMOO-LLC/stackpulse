import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unregisterServiceSchedule } from '@/lib/qstash'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cancel QStash schedule before deleting service
  const { data: svc } = await supabase
    .from('connected_services')
    .select('qstash_schedule_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  await unregisterServiceSchedule(svc?.qstash_schedule_id ?? null)

  const { error } = await supabase
    .from('connected_services')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
