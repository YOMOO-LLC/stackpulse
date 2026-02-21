import type { AlertCondition } from '@/lib/providers/types'

interface AlertConfigRow {
  id: string
  collector_id: string
  condition: string
  threshold_numeric: number | null
  threshold_text: string | null
  enabled: boolean
  last_notified_at: string | null
}

interface SnapshotInput {
  collectorId: string
  value: number | string | null
  status: string
}

const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

export function evaluateAlerts(
  rules: AlertConfigRow[],
  snapshot: SnapshotInput,
  options?: { skipCooldown?: boolean }
): AlertConfigRow[] {
  return rules.filter((rule) => {
    if (!rule.enabled) return false
    if (rule.collector_id !== snapshot.collectorId) return false
    if (snapshot.value === null) return false

    if (!options?.skipCooldown && rule.last_notified_at) {
      const elapsed = Date.now() - new Date(rule.last_notified_at).getTime()
      if (elapsed < COOLDOWN_MS) return false
    }

    const threshold = rule.threshold_numeric ?? rule.threshold_text ?? ''
    return checkThreshold(rule.condition as AlertCondition, threshold, snapshot.value)
  })
}

export function checkThreshold(
  condition: AlertCondition,
  threshold: number | string,
  currentValue: number | string
): boolean {
  switch (condition) {
    case 'lt':
      return Number(currentValue) < Number(threshold)
    case 'gt':
      return Number(currentValue) > Number(threshold)
    case 'eq':
    case 'status_is':
      return String(currentValue) === String(threshold)
    default:
      return false
  }
}
