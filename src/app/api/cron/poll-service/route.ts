import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { getProvider } from '@/lib/providers'
import { evaluateAlerts } from '@/lib/alerts/engine'
import { sendAlertEmail } from '@/lib/notifications/email'
import { fetchProviderMetrics } from '@/lib/providers/fetch'

async function handler(req: NextRequest) {
  const body = await req.json()
  const { serviceId } = body

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: service } = await supabase
    .from('connected_services')
    .select('id, provider_id, credentials, user_id, consecutive_failures, enabled, qstash_schedule_id')
    .eq('id', serviceId)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  if (!service.enabled) {
    return NextResponse.json({ skipped: true, reason: 'disabled' })
  }

  const provider = getProvider(service.provider_id)
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const credentials = JSON.parse(decrypt(service.credentials, process.env.ENCRYPTION_KEY!))

  try {
    const snapshots = await fetchProviderMetrics(service.provider_id, credentials)

    if (snapshots.length > 0) {
      await supabase.from('metric_snapshots').insert(
        snapshots.map((s) => ({
          connected_service_id: serviceId,
          collector_id: s.collectorId,
          value: s.value,
          value_text: s.valueText,
          unit: s.unit,
          status: s.status,
        }))
      )
    }

    await supabase
      .from('connected_services')
      .update({ consecutive_failures: 0, auth_expired: false })
      .eq('id', serviceId)

    const { data: rules } = await supabase
      .from('alert_configs')
      .select('id, collector_id, condition, threshold_numeric, threshold_text, enabled, last_notified_at')
      .eq('connected_service_id', serviceId)
      .eq('enabled', true)
      .order('created_at', { ascending: true })

    if (rules && rules.length > 0) {
      const { data: userData } = await supabase.auth.admin.getUserById(service.user_id)
      const userEmail = userData?.user?.email

      for (const snapshot of snapshots) {
        const triggered = evaluateAlerts(rules, {
          collectorId: snapshot.collectorId,
          value: snapshot.value,
          status: snapshot.status,
        })

        for (const rule of triggered) {
          await supabase.from('alert_events').insert({
            alert_config_id: rule.id,
            triggered_value_numeric: typeof snapshot.value === 'number' ? snapshot.value : null,
            triggered_value_text: typeof snapshot.value === 'string' ? snapshot.value : null,
          })

          await supabase
            .from('alert_configs')
            .update({ last_notified_at: new Date().toISOString() })
            .eq('id', rule.id)

          if (userEmail) {
            const collectorMeta = provider.collectors.find((c: { id: string }) => c.id === rule.collector_id)
            const collectorName = (collectorMeta as { name?: string } | undefined)?.name ?? rule.collector_id
            await sendAlertEmail({
              to: userEmail,
              serviceName: provider.name ?? service.provider_id,
              collectorName,
              condition: rule.condition,
              threshold: rule.threshold_numeric ?? rule.threshold_text ?? '',
              triggeredValue: snapshot.value ?? '',
              serviceId,
            })
          }
        }
      }
    }

    return NextResponse.json({ ok: true, snapshots: snapshots.length })
  } catch (err) {
    const newFailures = (service.consecutive_failures ?? 0) + 1
    const updates: Record<string, unknown> = { consecutive_failures: newFailures }

    if (newFailures >= 5) {
      updates.auth_expired = true
      updates.enabled = false
    }

    await supabase.from('connected_services').update(updates).eq('id', serviceId)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const POST = verifySignatureAppRouter(handler)
