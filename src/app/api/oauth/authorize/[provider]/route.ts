import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateState, setStateCookie, setLabelCookie } from '@/lib/oauth/state'
import { getOAuthConfig } from '@/lib/oauth/config'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const config = getOAuthConfig(provider)
  if (!config) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const url = new URL(req.url)
  const label = url.searchParams.get('label') ?? ''
  const state = generateState()

  await setStateCookie(state)
  if (label) await setLabelCookie(label)

  const authUrl = new URL(config.authorizationUrl)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', config.redirectUri)
  authUrl.searchParams.set('state', state)
  if (config.scopes.length > 0) {
    authUrl.searchParams.set('scope', config.scopes.join(' '))
  }

  return NextResponse.redirect(authUrl.toString())
}
