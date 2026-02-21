import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { evaluateAlerts } from '@/lib/alerts/engine'
import { sendAlertEmail } from '@/lib/notifications/email'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: serviceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { collector_id, value } = body as { collector_id?: string; value?: number | string }

  if (!collector_id || value === undefined || value === null) {
    return NextResponse.json({ error: 'collector_id and value are required' }, { status: 400 })
  }

  // Verify service ownership
  const { data: service } = await supabase
    .from('connected_services')
    .select('id, provider_id, user_id')
    .eq('id', serviceId)
    .eq('user_id', user.id)
    .single()

  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  const provider = getProvider(service.provider_id)

  // Insert a fake metric snapshot
  const { error: snapErr } = await supabase.from('metric_snapshots').insert({
    connected_service_id: serviceId,
    collector_id,
    value: typeof value === 'number' ? value : null,
    value_text: typeof value === 'string' ? value : null,
    unit: provider?.collectors.find((c) => c.id === collector_id)?.unit ?? null,
    status: 'simulated',
  })
  if (snapErr) console.error('[simulate-metric] snapshot insert error:', snapErr.message)

  // Fetch all enabled alert rules for this service
  const { data: rules } = await supabase
    .from('alert_configs')
    .select('id, collector_id, condition, threshold_numeric, threshold_text, enabled, last_notified_at')
    .eq('connected_service_id', serviceId)
    .eq('enabled', true)

  if (!rules || rules.length === 0) {
    return NextResponse.json({ triggered: [], message: 'No alert rules configured' })
  }

  // Evaluate — skip cooldown so tests always fire
  const triggered = evaluateAlerts(
    rules,
    { collectorId: collector_id, value, status: 'simulated' },
    { skipCooldown: true }
  )

  const results: { ruleId: string; collectorId: string; condition: string; threshold: number | string }[] = []

  for (const rule of triggered) {
    // Record alert event
    const { error: evtErr } = await supabase.from('alert_events').insert({
      alert_config_id: rule.id,
      triggered_value_numeric: typeof value === 'number' ? value : null,
      triggered_value_text: typeof value === 'string' ? value : null,
    })

    if (evtErr) {
      console.error('[simulate-metric] alert_event insert error:', evtErr.message)
      return NextResponse.json(
        { error: `DB write failed: ${evtErr.message}` },
        { status: 500 }
      )
    }

    // Send email notification
    const collectorName = provider?.collectors.find((c) => c.id === rule.collector_id)?.name ?? rule.collector_id
    await sendAlertEmail({
      to: user.email!,
      serviceName: provider?.name ?? service.provider_id,
      collectorName,
      condition: rule.condition,
      threshold: rule.threshold_numeric ?? rule.threshold_text ?? '',
      triggeredValue: value,
      serviceId,
    })

    results.push({
      ruleId: rule.id,
      collectorId: rule.collector_id,
      condition: rule.condition,
      threshold: rule.threshold_numeric ?? rule.threshold_text ?? '',
    })
  }

  return NextResponse.json({
    triggered: results,
    totalRules: rules.length,
    message: triggered.length > 0
      ? `${triggered.length} alert(s) triggered — email sent to ${user.email}`
      : 'No alerts triggered with this value',
  })
}
