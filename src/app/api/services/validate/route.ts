import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'

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
    const results = await provider.fetchMetrics(credentials)
    const hasHealthy = results.some(r => r.status !== 'unknown')
    const bestStatus = hasHealthy
      ? (results.find(r => r.status === 'healthy')?.status ?? results[0]?.status ?? 'unknown')
      : 'unknown'
    const result = { valid: hasHealthy, status: bestStatus }
    console.log('[validate]', providerId, result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[validate] error:', err)
    return NextResponse.json({ valid: false, status: 'unknown' })
  }
}
