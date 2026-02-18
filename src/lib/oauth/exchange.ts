import type { OAuthProviderConfig } from './config'

export interface OAuthTokens {
  access_token: string
  refresh_token: string | null
  expires_at: number | null
  token_type: string
  scope?: string
}

export async function exchangeCodeForToken(
  code: string,
  config: OAuthProviderConfig
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`)
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(`OAuth error: ${json.error}`)
  }

  const expiresIn: number | null = json.expires_in ?? null
  const expires_at = expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at,
    token_type: json.token_type ?? 'bearer',
    scope: json.scope,
  }
}
