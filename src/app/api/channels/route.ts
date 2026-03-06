import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Always include the default email channel
  const channels: object[] = [{
    type: 'email',
    config: { email: user.email },
    isDefault: true,
  }]

  // Fetch saved notification channels from DB
  const { data: dbChannels } = await supabase
    .from('notification_channels')
    .select('id, type, name, config, enabled')
    .eq('user_id', user.id)

  if (dbChannels) {
    const encryptionKey = process.env.ENCRYPTION_KEY!
    for (const ch of dbChannels) {
      try {
        const decryptedConfig = JSON.parse(decrypt(ch.config, encryptionKey))
        channels.push({
          id: ch.id,
          type: ch.type,
          name: ch.name,
          config: decryptedConfig,
          enabled: ch.enabled,
        })
      } catch {
        // Skip channels with corrupted config
        console.error(`[channels] Failed to decrypt config for channel ${ch.id}`)
      }
    }
  }

  return NextResponse.json({ channels })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type: channelType, config } = body

  const { limits } = await getUserPlan(user.id)
  if (!limits.channels.includes(channelType)) {
    return NextResponse.json(
      { error: `Channel type "${channelType}" not available on your plan.` },
      { status: 403 },
    )
  }

  // Validate slack-specific config
  if (channelType === 'slack') {
    if (!config?.webhook_url) {
      return NextResponse.json(
        { error: 'Slack webhook URL is required.' },
        { status: 400 },
      )
    }
  }

  // For non-email channels, save to notification_channels table
  if (channelType !== 'email') {
    const encryptionKey = process.env.ENCRYPTION_KEY!
    const encryptedConfig = encrypt(JSON.stringify(config), encryptionKey)

    const { data: saved, error: saveError } = await supabase
      .from('notification_channels')
      .upsert({
        user_id: user.id,
        type: channelType,
        name: channelType.charAt(0).toUpperCase() + channelType.slice(1),
        config: encryptedConfig,
        enabled: true,
      }, { onConflict: 'user_id,type' })
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({ error: 'Failed to save channel.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, channelId: saved?.id })
  }

  return NextResponse.json({ ok: true })
}
