import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { fetchOpenRouterMetrics } from '@/lib/providers/openrouter'
import { fetchSentryMetrics } from '@/lib/providers/sentry'
import { fetchResendMetrics } from '@/lib/providers/resend'

async function validateCredentials(
  providerId: string,
  credentials: Record<string, string>
): Promise<{ valid: boolean; status: string }> {
  switch (providerId) {
    case 'openrouter': {
      const result = await fetchOpenRouterMetrics(credentials.apiKey)
      return { valid: result.status !== 'unknown', status: result.status }
    }
    case 'sentry': {
      const result = await fetchSentryMetrics(credentials.authToken, credentials.orgSlug)
      return { valid: result.status !== 'unknown', status: result.status }
    }
    case 'resend': {
      const result = await fetchResendMetrics(credentials.apiKey)
      return { valid: result.status !== 'unknown', status: result.status }
    }
    default:
      return { valid: false, status: 'unknown' }
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { providerId, credentials } = await req.json()
  const provider = getProvider(providerId)
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  try {
    const result = await validateCredentials(providerId, credentials)
    console.log('[validate]', providerId, result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[validate] error:', err)
    return NextResponse.json({ valid: false, status: 'unknown' })
  }
}
