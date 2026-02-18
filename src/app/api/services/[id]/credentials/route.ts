import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import { getProvider } from '@/lib/providers'
import { registerServiceSchedule } from '@/lib/qstash'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { credentials, providerId } = body

  if (!credentials || !providerId) {
    return NextResponse.json({ error: 'credentials and providerId required' }, { status: 400 })
  }

  const provider = getProvider(providerId)
  if (!provider) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  const encryptionKey = process.env.ENCRYPTION_KEY!
  const encryptedCredentials = encrypt(JSON.stringify(credentials), encryptionKey)

  let scheduleId: string | undefined
  try {
    scheduleId = await registerServiceSchedule(id)
  } catch { /* non-fatal */ }

  const { error } = await supabase
    .from('connected_services')
    .update({
      credentials: encryptedCredentials,
      auth_expired: false,
      consecutive_failures: 0,
      ...(scheduleId ? { qstash_schedule_id: scheduleId } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
