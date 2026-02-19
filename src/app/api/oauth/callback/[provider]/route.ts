import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyStateCookie, getLabelCookie } from '@/lib/oauth/state'
import { getOAuthConfig } from '@/lib/oauth/config'
import { exchangeCodeForToken, type OAuthTokens } from '@/lib/oauth/exchange'
import { encrypt } from '@/lib/crypto'
import { getProvider } from '@/lib/providers'
import { fetchProviderMetrics } from '@/lib/providers/fetch'
import { registerServiceSchedule } from '@/lib/qstash'

async function getSentryOrgSlug(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://sentry.io/api/0/organizations/', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const orgs = await res.json()
    return orgs[0]?.slug ?? null
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const url = new URL(req.url)

  // Provider cancelled authorization
  if (url.searchParams.get('error')) {
    return NextResponse.redirect(new URL('/connect', req.url))
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(new URL('/connect', req.url))
  }

  // CSRF check
  const stateValid = await verifyStateCookie(state)
  if (!stateValid) {
    return NextResponse.redirect(new URL(`/connect/${provider}?error=oauth_failed`, req.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const config = getOAuthConfig(provider)
  const serviceProvider = getProvider(provider)
  if (!config || !serviceProvider) {
    return NextResponse.redirect(new URL('/connect', req.url))
  }

  try {
    const tokens = await exchangeCodeForToken(code, config)
    const label = await getLabelCookie() ?? serviceProvider.name

    // Sentry needs org slug for metric fetching
    const credentialsPayload: OAuthTokens & { orgSlug?: string } = { ...tokens }
    if (provider === 'sentry') {
      const orgSlug = await getSentryOrgSlug(tokens.access_token)
      if (orgSlug) credentialsPayload.orgSlug = orgSlug
    }

    const encryptedCredentials = encrypt(
      JSON.stringify(credentialsPayload),
      process.env.ENCRYPTION_KEY!
    )

    const { data, error: dbError } = await supabase
      .from('connected_services')
      .insert({
        user_id: user.id,
        provider_id: provider,
        label,
        credentials: encryptedCredentials,
      })
      .select('id')
      .single()

    if (dbError) throw dbError

    // Initial metric collection (non-fatal)
    try {
      const snapshots = await fetchProviderMetrics(provider, credentialsPayload as unknown as Record<string, string>)
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
      // Initial collection failure does not affect service save
    }

    // Register QStash schedule (non-fatal)
    try {
      const scheduleId = await registerServiceSchedule(data.id)
      await supabase
        .from('connected_services')
        .update({ qstash_schedule_id: scheduleId })
        .eq('id', data.id)
    } catch {
      console.error('[qstash] Failed to register schedule for OAuth service')
    }

    return NextResponse.redirect(new URL('/dashboard', req.url))
  } catch {
    return NextResponse.redirect(new URL(`/connect/${provider}?error=oauth_failed`, req.url))
  }
}
