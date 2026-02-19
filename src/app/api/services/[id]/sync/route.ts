import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'
import { getOAuthConfig } from '@/lib/oauth/config'
import { needsRefresh, refreshAccessToken } from '@/lib/oauth/refresh'
import { getProvider } from '@/lib/providers'
import { fetchProviderMetrics } from '@/lib/providers/fetch'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: serviceId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: service } = await supabase
    .from('connected_services')
    .select('id, provider_id, credentials, consecutive_failures, enabled')
    .eq('id', serviceId)
    .eq('user_id', user.id)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  const provider = getProvider(service.provider_id)
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const credentials = JSON.parse(decrypt(service.credentials, process.env.ENCRYPTION_KEY!))

  // Proactively refresh OAuth token if needed
  if (provider.authType === 'oauth2') {
    const oauthConfig = getOAuthConfig(service.provider_id)
    if (oauthConfig?.supportsRefresh && needsRefresh(credentials.expires_at) && credentials.refresh_token) {
      try {
        const newTokens = await refreshAccessToken(credentials.refresh_token, oauthConfig)
        const updated = { ...credentials, ...newTokens }
        const encryptedUpdated = encrypt(JSON.stringify(updated), process.env.ENCRYPTION_KEY!)
        await supabase.from('connected_services').update({ credentials: encryptedUpdated }).eq('id', serviceId)
        Object.assign(credentials, updated)
      } catch {
        // proceed with existing token
      }
    }
  }

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

    return NextResponse.json({ ok: true, snapshots: snapshots.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
