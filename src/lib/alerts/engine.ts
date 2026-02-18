import type { AlertCondition } from '@/lib/providers/types'

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
