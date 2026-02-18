import { registerProvider } from './registry'
import { openrouterProvider } from './openrouter'
import { resendProvider } from './resend'
import { sentryProvider } from './sentry'

// 注册所有 Provider（模块加载时自动执行）
registerProvider(openrouterProvider)
registerProvider(resendProvider)
registerProvider(sentryProvider)

export { getProvider, getAllProviders, registerProvider, clearProviders } from './registry'
export { validateProvider } from './validator'
export { openrouterProvider, fetchOpenRouterMetrics } from './openrouter'
export { resendProvider, fetchResendMetrics } from './resend'
export { sentryProvider, fetchSentryMetrics } from './sentry'
export type { ServiceProvider, Collector, Category, MetricType, AlertTemplate, Credentials, MetricValue } from './types'
