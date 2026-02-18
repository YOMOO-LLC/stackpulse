import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export function generateState(): string {
  return randomBytes(32).toString('hex')
}

export async function setStateCookie(state: string): Promise<void> {
  const jar = await cookies()
  jar.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
}

export async function verifyStateCookie(state: string): Promise<boolean> {
  const jar = await cookies()
  const stored = jar.get('oauth_state')?.value
  jar.delete('oauth_state')
  return stored === state
}

export async function setLabelCookie(label: string): Promise<void> {
  const jar = await cookies()
  jar.set('oauth_label', label, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
}

export async function getLabelCookie(): Promise<string | null> {
  const jar = await cookies()
  const label = jar.get('oauth_label')?.value ?? null
  jar.delete('oauth_label')
  return label
}
