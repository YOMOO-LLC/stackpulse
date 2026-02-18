import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { encrypt } from '@/lib/crypto'
import { fetchOpenRouterMetrics } from '@/lib/providers/openrouter'
import { fetchResendMetrics } from '@/lib/providers/resend'
import { fetchSentryMetrics } from '@/lib/providers/sentry'

interface SnapshotInput {
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
}

async function collectInitialMetrics(
  providerId: string,
  credentials: Record<string, string>
): Promise<SnapshotInput[]> {
  switch (providerId) {
    case 'openrouter': {
      const r = await fetchOpenRouterMetrics(credentials.apiKey)
      return [{
        collectorId: 'credit_balance',
        value: r.value ?? null,
        valueText: null,
        unit: 'USD',
        status: r.status,
      }]
    }
    case 'resend': {
      const r = await fetchResendMetrics(credentials.apiKey)
      return [{
        collectorId: 'connection_status',
        value: null,
        valueText: r.value ?? null,
        unit: '',
        status: r.status,
      }]
    }
    case 'sentry': {
      const r = await fetchSentryMetrics(credentials.authToken, credentials.orgSlug)
      return [{
        collectorId: 'error_count',
        value: r.value ?? null,
        valueText: null,
        unit: 'events',
        status: r.status,
      }]
    }
    default:
      return []
  }
}

interface Snapshot {
  connected_service_id: string
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: string
  fetched_at: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: services, error } = await supabase
    .from('connected_services')
    .select('id, provider_id, label, enabled, auth_expired, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const serviceIds = (services ?? []).map((s) => s.id)
  const { data: snapshots } = serviceIds.length > 0 ? await supabase
    .from('metric_snapshots')
    .select('connected_service_id, collector_id, value, value_text, unit, status, fetched_at')
    .in('connected_service_id', serviceIds)
    .order('fetched_at', { ascending: false }) : { data: [] as Snapshot[] }

  const latestSnapshots = new Map<string, Snapshot>()
  for (const snap of (snapshots ?? []) as Snapshot[]) {
    const key = `${snap.connected_service_id}:${snap.collector_id}`
    if (!latestSnapshots.has(key)) latestSnapshots.set(key, snap)
  }

  const result = (services ?? []).map((service) => {
    const provider = getProvider(service.provider_id)
    const serviceSnapshots = Array.from(latestSnapshots.values()).filter(
      (s) => s.connected_service_id === service.id
    )
    return {
      ...service,
      providerName: provider?.name ?? service.provider_id,
      providerIcon: provider?.icon,
      category: provider?.category,
      collectors: provider?.collectors.map((c) => ({
        id: c.id,
        name: c.name,
        metricType: c.metricType,
        snapshot: serviceSnapshots.find((s) => s.collector_id === c.id) ?? null,
      })) ?? [],
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { providerId, credentials, label } = body

  if (!providerId || !credentials) {
    return NextResponse.json({ error: 'providerId and credentials are required' }, { status: 400 })
  }

  const provider = getProvider(providerId)
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!
  const encryptedCredentials = encrypt(JSON.stringify(credentials), encryptionKey)

  const { data, error } = await supabase
    .from('connected_services')
    .insert({
      user_id: user.id,
      provider_id: providerId,
      label: label ?? provider.name,
      credentials: encryptedCredentials,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 首次连接后立即采集一次
  try {
    const snapshots = await collectInitialMetrics(providerId, credentials)
    if (snapshots.length > 0) {
      await supabase.from('metric_snapshots').insert(
        snapshots.map((s) => ({
          connected_service_id: data.id,
          collector_id: s.collectorId,
          value: s.value,
          value_text: s.valueText,
          unit: s.unit,
          status: s.status,
        }))
      )
    }
  } catch {
    // 首次采集失败不影响服务保存
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
