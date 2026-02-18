import type { ServiceProvider } from './types'
import { VALID_METRIC_TYPES } from './types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export function validateProvider(provider: ServiceProvider): ValidationResult {
  const errors: ValidationError[] = []

  if (!provider.id || provider.id.trim() === '') {
    errors.push({ field: 'id', message: 'Provider id must not be empty' })
  }

  if (!provider.collectors || provider.collectors.length === 0) {
    errors.push({ field: 'collectors', message: 'Provider must have at least one collector' })
  } else {
    provider.collectors.forEach((collector, i) => {
      if (collector.refreshInterval < 60) {
        errors.push({
          field: `collectors[${i}].refreshInterval`,
          message: `Refresh interval must be >= 60 seconds, got ${collector.refreshInterval}`,
        })
      }
      if (!VALID_METRIC_TYPES.includes(collector.metricType)) {
        errors.push({
          field: `collectors[${i}].metricType`,
          message: `Invalid metric type: ${collector.metricType}`,
        })
      }
    })
  }

  return { valid: errors.length === 0, errors }
}
