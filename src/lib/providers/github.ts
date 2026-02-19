import type { ServiceProvider } from './types'

export const githubProvider: ServiceProvider = {
  id: 'github',
  name: 'GitHub',
  category: 'hosting',
  icon: '/icons/github.svg',
  authType: 'oauth2',
  credentials: [
    { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_...' },
  ],
  collectors: [
    { id: 'rate_limit_remaining', name: 'API Rate Limit Remaining', metricType: 'count', unit: 'requests', refreshInterval: 300 },
    { id: 'rate_limit_used', name: 'API Rate Limit Used', metricType: 'count', unit: 'requests', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'rate-limit-low', name: 'Rate Limit Low', collectorId: 'rate_limit_remaining', condition: 'lt', defaultThreshold: 500, message: 'GitHub API rate limit below 500 requests' },
  ],
}

export interface GitHubMetricResult {
  rateLimitRemaining: number | null
  rateLimitUsed: number | null
  rateLimitTotal: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchGitHubMetrics(token: string): Promise<GitHubMetricResult> {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) {
      return { rateLimitRemaining: null, rateLimitUsed: null, rateLimitTotal: null, status: 'unknown', error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    const core = json.resources?.core ?? json.rate
    const remaining = core?.remaining ?? null
    const limit = core?.limit ?? null
    const used = core?.used ?? null
    const pct = limit && limit > 0 ? (limit - (remaining ?? 0)) / limit : 0
    return { rateLimitRemaining: remaining, rateLimitUsed: used, rateLimitTotal: limit, status: pct > 0.8 ? 'warning' : 'healthy' }
  } catch {
    return { rateLimitRemaining: null, rateLimitUsed: null, rateLimitTotal: null, status: 'unknown', error: 'Network error' }
  }
}
