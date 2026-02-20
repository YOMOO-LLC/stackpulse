import type { SnapshotResult } from './fetch'

export type MetricType = 'currency' | 'percentage' | 'count' | 'status' | 'boolean'
export type Category = 'ai' | 'monitoring' | 'email' | 'hosting' | 'payment' | 'infrastructure' | 'other'
export type AlertCondition = 'lt' | 'gt' | 'eq' | 'status_is'
export type DisplayHint = 'number' | 'progress' | 'status-badge' | 'currency'

export interface MetricValue {
  collectorId: string
  value: number | string | boolean
  timestamp: string
}

export interface Credentials {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  required: boolean
  placeholder?: string
}

export interface CollectorThresholds {
  warning: number
  critical: number
  direction: 'below' | 'above'
  max?: number
}

export interface Collector {
  id: string
  name: string
  metricType: MetricType
  unit: string
  refreshInterval: number
  endpoint?: string
  description?: string
  displayHint?: DisplayHint
  thresholds?: CollectorThresholds
  trend?: boolean
}

export interface ApiKeyAuth { type: 'api_key' }
export interface OAuth2Auth { type: 'oauth2'; authorizationUrl: string; tokenUrl: string; scopes: string[] }
export interface HybridAuth { type: 'hybrid'; oauth2: Omit<OAuth2Auth, 'type'> }
export type AuthConfig = ApiKeyAuth | OAuth2Auth | HybridAuth

export interface AlertTemplate {
  id: string
  name: string
  collectorId: string
  condition: AlertCondition
  defaultThreshold: number | string
  message: string
}

export interface ServiceProvider {
  id: string
  name: string
  category: Category
  icon: string
  authType: 'api_key' | 'oauth2' | 'hybrid' | 'token'
  credentials: Credentials[]
  collectors: Collector[]
  alerts: AlertTemplate[]
  fetchMetrics?: (credentials: Record<string, string>) => Promise<SnapshotResult[]>
  metricsLayout?: 'cards' | 'stats-grid'
}

export const VALID_METRIC_TYPES: MetricType[] = ['currency', 'percentage', 'count', 'status', 'boolean']
export const VALID_CATEGORIES: Category[] = ['ai', 'monitoring', 'email', 'hosting', 'payment', 'infrastructure', 'other']
export const VALID_ALERT_CONDITIONS: AlertCondition[] = ['lt', 'gt', 'eq', 'status_is']
