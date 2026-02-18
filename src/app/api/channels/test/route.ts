import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
