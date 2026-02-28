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

  if (!provider.projectSelector) {
    return NextResponse.json({ error: 'Provider does not support project selection' }, { status: 400 })
  }

  try {
    const options = await provider.projectSelector.fetch(credentials)
    return NextResponse.json({ options })
  } catch (err) {
    console.error('[projects] error:', err)
    return NextResponse.json({ options: [] })
  }
}
