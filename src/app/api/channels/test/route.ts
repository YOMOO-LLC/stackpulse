import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { decrypt } from '@/lib/crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { type?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body means default email test
  }

  const { type: channelType } = body

  if (channelType === 'slack') {
    // Look up the user's Slack channel config
    const { data: channel, error: chError } = await supabase
      .from('notification_channels')
      .select('id, config')
      .eq('user_id', user.id)
      .eq('type', 'slack')
      .single()

    if (chError || !channel) {
      return NextResponse.json({ error: 'No Slack channel configured' }, { status: 404 })
    }

    try {
      const encryptionKey = process.env.ENCRYPTION_KEY!
      const config = JSON.parse(decrypt(channel.config, encryptionKey))

      await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'This is a *test alert* from StackPulse. Your Slack notifications are working correctly.',
              },
            },
          ],
        }),
      })

      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Failed to send Slack test message' }, { status: 500 })
    }
  }

  // Default: send email test
  try {
    await resend.emails.send({
      from: 'StackPulse Alerts <alerts@stackpulse.app>',
      to: user.email!,
      subject: '[StackPulse] Test Alert',
      html: '<p>This is a test alert from StackPulse. Your email notifications are working correctly.</p>',
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 })
  }
}
