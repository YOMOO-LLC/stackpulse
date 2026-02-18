import { registerProvider } from './registry'
import { openrouterProvider } from './openrouter'
import { resendProvider } from './resend'
import { sentryProvider } from './sentry'
import { stripeProvider } from './stripe'
import { githubProvider } from './github'
import { vercelProvider } from './vercel'
import { openaiProvider } from './openai'
import { upstashRedisProvider } from './upstash-redis'
import { upstashQStashProvider } from './upstash-qstash'

// Register all providers (executed on module load)
registerProvider(openrouterProvider)
registerProvider(resendProvider)
registerProvider(sentryProvider)
registerProvider(stripeProvider)
registerProvider(githubProvider)
registerProvider(vercelProvider)
registerProvider(openaiProvider)
registerProvider(upstashRedisProvider)
registerProvider(upstashQStashProvider)

export { getProvider, getAllProviders, registerProvider, clearProviders } from './registry'
export { validateProvider } from './validator'
export { openrouterProvider, fetchOpenRouterMetrics } from './openrouter'
export { resendProvider, fetchResendMetrics } from './resend'
export { sentryProvider, fetchSentryMetrics } from './sentry'
export { stripeProvider, fetchStripeMetrics } from './stripe'
export { githubProvider, fetchGitHubMetrics } from './github'
export { vercelProvider, fetchVercelMetrics } from './vercel'
export { openaiProvider, fetchOpenAIMetrics } from './openai'
export { upstashRedisProvider, fetchUpstashRedisMetrics } from './upstash-redis'
export { upstashQStashProvider, fetchUpstashQStashMetrics } from './upstash-qstash'
export type { ServiceProvider, Collector, Category, MetricType, AlertTemplate, Credentials, MetricValue } from './types'
