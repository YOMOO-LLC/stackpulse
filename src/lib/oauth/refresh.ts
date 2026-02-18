import type { OAuthProviderConfig } from './config'
import type { OAuthTokens } from './exchange'

const REFRESH_THRESHOLD_SECONDS = 600 // refresh if < 10 minutes remaining

export function needsRefresh(expiresAt: number | null): boolean {
  if (expiresAt === null) return false
  return expiresAt - Math.floor(Date.now() / 1000) < REFRESH_THRESHOLD_SECONDS
}

export async function refreshAccessToken(
  refreshToken: string,
  config: OAuthProviderConfig
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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
    throw new Error(`Token refresh failed: ${res.status}`)
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(`Refresh error: ${json.error}`)
  }

  const expiresIn: number | null = json.expires_in ?? null
  const expires_at = expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_at,
    token_type: json.token_type ?? 'bearer',
  }
}
