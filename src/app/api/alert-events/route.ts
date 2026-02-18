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
  const offset = Number(searchParams.get('offset') ?? '0')
  const limit = 20

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 })
  }

  // Fetch alert_configs for this service first to get their IDs
  const { data: configs } = await supabase
    .from('alert_configs')
    .select('id')
    .eq('connected_service_id', serviceId)
    .eq('user_id', user.id)

  const configIds = (configs ?? []).map((c) => c.id)

  if (configIds.length === 0) {
    return NextResponse.json({ events: [], hasMore: false })
  }

  const { data: events, error } = await supabase
    .from('alert_events')
    .select('id, notified_at, triggered_value_numeric, triggered_value_text, alert_config_id')
    .in('alert_config_id', configIds)
    .order('notified_at', { ascending: false })
    .range(offset, offset + limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = events ?? []
  // Fetch alert_configs details for display
  const eventConfigIds = [...new Set(items.map((e) => e.alert_config_id))]
  const { data: eventConfigs } = eventConfigIds.length > 0 ? await supabase
    .from('alert_configs')
    .select('id, collector_id, condition, threshold_numeric')
    .in('id', eventConfigIds) : { data: [] }

  const configMap = new Map((eventConfigs ?? []).map((c) => [c.id, c]))

  const enriched = items.slice(0, limit).map((e) => ({
    ...e,
    alert_configs: configMap.get(e.alert_config_id) ?? null,
  }))

  return NextResponse.json({
    events: enriched,
    hasMore: items.length > limit,
  })
}
