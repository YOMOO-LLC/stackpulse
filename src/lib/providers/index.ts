import { registerProvider } from './registry'
import { openrouterProvider } from './openrouter'
import { resendProvider } from './resend'
import { sentryProvider } from './sentry'

// Register all providers (executed on module load)
registerProvider(openrouterProvider)
registerProvider(resendProvider)
registerProvider(sentryProvider)

export { getProvider, getAllProviders, registerProvider, clearProviders } from './registry'
export { validateProvider } from './validator'
export { openrouterProvider, fetchOpenRouterMetrics } from './openrouter'
export { resendProvider, fetchResendMetrics } from './resend'
export { sentryProvider, fetchSentryMetrics } from './sentry'
export type { ServiceProvider, Collector, Category, MetricType, AlertTemplate, Credentials, MetricValue } from './types'
