import type { ServiceProvider } from './types'
import { validateProvider } from './validator'

const providers = new Map<string, ServiceProvider>()

export function registerProvider(provider: ServiceProvider): void {
  const result = validateProvider(provider)
  if (!result.valid) {
    const msgs = result.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
    throw new Error(`Invalid provider: ${msgs}`)
  }
  providers.set(provider.id, provider)
}

export function getProvider(id: string): ServiceProvider | undefined {
  return providers.get(id)
}

export function getAllProviders(): ServiceProvider[] {
  return Array.from(providers.values())
}

export function clearProviders(): void {
  providers.clear()
}
