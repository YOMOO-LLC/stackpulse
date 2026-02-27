type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

// ── timeAgo ──────────────────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── groupByProvider ──────────────────────────────────────────────────────────

export type ServiceRow = {
  id: string
  providerId: string
  providerName: string
  label: string
  status: Status
  authExpired?: boolean
  collectors: CollectorRow[]
  lastUpdated: string | undefined
}

export type CollectorRow = {
  id: string
  name: string
  snapshot: {
    value: number | null
    value_text: string | null
    unit: string | null
    status: Status
    fetched_at: string
  } | null
}

export type ProviderGroup = {
  providerId: string
  providerName: string
  isGroup: boolean   // true when >1 service with same providerId
  services: ServiceRow[]
  groupStatus: Status
}

export function groupByProvider(services: ServiceRow[]): ProviderGroup[] {
  const map = new Map<string, ServiceRow[]>()
  for (const svc of services) {
    const arr = map.get(svc.providerId) ?? []
    arr.push(svc)
    map.set(svc.providerId, arr)
  }

  const groups: ProviderGroup[] = []
  for (const [providerId, svcs] of map) {
    groups.push({
      providerId,
      providerName: svcs[0].providerName,
      isGroup: svcs.length > 1,
      services: svcs,
      groupStatus: computeGroupStatus(svcs.map((s) => s.status)),
    })
  }
  return groups
}

// ── computeGroupStatus ────────────────────────────────────────────────────────

export function computeGroupStatus(statuses: string[]): Status {
  if (statuses.length === 0) return 'unknown'
  if (statuses.includes('critical')) return 'critical'
  if (statuses.includes('warning')) return 'warning'
  if (statuses.every((s) => s === 'healthy')) return 'healthy'
  return 'unknown'
}

// ── pickKeyMetrics ────────────────────────────────────────────────────────────

export function pickKeyMetrics(collectors: CollectorRow[], max: number): CollectorRow[] {
  return collectors.filter((c) => c.snapshot !== null).slice(0, max)
}

// ── formatAlertTitle ─────────────────────────────────────────────────────────

export function formatAlertTitle(
  serviceLabel: string,
  collectorId: string,
  condition: string,
  threshold: number | null,
): string {
  const thresholdStr = threshold !== null
    ? condition === 'gt' ? ` (>${threshold})`
      : condition === 'lt' ? ` (<${threshold})`
      : ` (=${threshold})`
    : ''

  const verb =
    condition === 'gt' ? 'exceeded threshold'
    : condition === 'lt' ? 'below threshold'
    : 'equals threshold'

  return `${serviceLabel} ${collectorId} ${verb}${thresholdStr}`
}
