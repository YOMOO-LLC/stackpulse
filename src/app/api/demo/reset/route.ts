import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ALL_DEMO_SEQUENCES } from '@/lib/providers/demo-sequences'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // -- 1. Authenticate --------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearerMatch = authHeader.match(/^Bearer (.+)$/)
  const bearerToken = bearerMatch?.[1]
  const resetSecret = process.env.DEMO_RESET_SECRET

  const supabase = await createClient()

  let authed = false

  if (bearerToken && resetSecret && bearerToken === resetSecret) {
    authed = true
  } else {
    // Check if authenticated demo user session
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email === process.env.NEXT_PUBLIC_DEMO_EMAIL) {
      authed = true
    }
  }

  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // -- 2. Get demo user's service IDs -----------------------------------------
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL
  if (!demoEmail) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_DEMO_EMAIL not configured' }, { status: 500 })
  }

  // Look up demo user by email via admin API
  const { data: listData } = await supabase.auth.admin.listUsers()
  const demoUser = listData?.users.find((u: { email?: string }) => u.email === demoEmail)

  if (!demoUser) {
    return NextResponse.json({ ok: true, reset_at: new Date().toISOString(), message: 'Demo user not found' })
  }

  const demoProviderIds = ALL_DEMO_SEQUENCES.map((s) => s.providerId)

  const { data: services, error: svcErr } = await supabase
    .from('connected_services')
    .select('id, provider_id')
    .eq('user_id', demoUser.id)
    .in('provider_id', demoProviderIds)

  if (svcErr) {
    return NextResponse.json({ error: svcErr.message }, { status: 500 })
  }

  const serviceIds = (services ?? []).map((s: { id: string }) => s.id)

  if (serviceIds.length === 0) {
    return NextResponse.json({ ok: true, reset_at: new Date().toISOString(), message: 'No demo services found' })
  }

  // -- 3. Delete existing metric_snapshots and alert_events --------------------
  const { error: snapErr } = await supabase
    .from('metric_snapshots')
    .delete()
    .in('connected_service_id', serviceIds)

  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  // Get alert_config ids for these services, then delete events and configs
  const { data: configs } = await supabase
    .from('alert_configs')
    .select('id')
    .in('connected_service_id', serviceIds)

  const configIds = (configs ?? []).map((c: { id: string }) => c.id)
  if (configIds.length > 0) {
    await supabase.from('alert_events').delete().in('alert_config_id', configIds)
  }

  // -- 4. Re-insert demoSnapshots ---------------------------------------------
  const providerToServiceId = new Map(
    (services ?? []).map((s: { id: string; provider_id: string }) => [s.provider_id, s.id])
  )

  const now = Date.now()
  const snapshotRows: Array<{
    connected_service_id: string
    collector_id: string
    value: number | null
    value_text: string | null
    unit: string
    status: string
    fetched_at: string
  }> = []

  for (const seq of ALL_DEMO_SEQUENCES) {
    const svcId = providerToServiceId.get(seq.providerId)
    if (!svcId) continue
    for (const snap of seq.snapshots) {
      snapshotRows.push({
        connected_service_id: svcId,
        collector_id: snap.collectorId,
        value: snap.value,
        value_text: snap.valueText,
        unit: snap.unit,
        status: snap.status,
        fetched_at: new Date(now - snap.hoursAgo * 3600 * 1000).toISOString(),
      })
    }
  }

  if (snapshotRows.length > 0) {
    const { error: insertErr } = await supabase.from('metric_snapshots').insert(snapshotRows)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // -- 5. Reset connected_services fields --------------------------------------
  await supabase
    .from('connected_services')
    .update({ consecutive_failures: 0, auth_expired: false })
    .in('id', serviceIds)

  return NextResponse.json({ ok: true, reset_at: new Date().toISOString() })
}
