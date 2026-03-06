/**
 * Lemon Squeezy Setup Script
 *
 * Usage:
 *   npx tsx scripts/setup-lemonsqueezy.ts
 *
 * Prerequisites:
 *   1. Set LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID in .env.local
 *   2. Create 2 products in Lemon Squeezy dashboard:
 *      - "StackPulse Pro" with 2 variants: Monthly ($4.99) and Yearly ($49.99)
 *      - "StackPulse Business" with 2 variants: Monthly ($19.99) and Yearly ($199.99)
 *
 * This script will:
 *   - List all products and variants in your store
 *   - Auto-detect Pro/Business variants by price
 *   - Create a webhook for subscription events
 *   - Output the env vars to add to .env.local
 */

import {
  lemonSqueezySetup,
  listProducts,
  listVariants,
  createWebhook,
  listWebhooks,
} from '@lemonsqueezy/lemonsqueezy.js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIndex = trimmed.indexOf('=')
  if (eqIndex > 0) {
    envVars[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1)
  }
}

const API_KEY = envVars.LEMONSQUEEZY_API_KEY
const STORE_ID = envVars.LEMONSQUEEZY_STORE_ID
const APP_URL = envVars.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

if (!API_KEY) {
  console.error('❌ LEMONSQUEEZY_API_KEY not set in .env.local')
  process.exit(1)
}
if (!STORE_ID) {
  console.error('❌ LEMONSQUEEZY_STORE_ID not set in .env.local')
  process.exit(1)
}

lemonSqueezySetup({ apiKey: API_KEY })

async function main() {
  console.log('🍋 Lemon Squeezy Setup for StackPulse\n')
  console.log(`Store ID: ${STORE_ID}`)
  console.log(`App URL: ${APP_URL}\n`)

  // 1. List products
  console.log('── Products ──────────────────────────────')
  const products = await listProducts({ filter: { storeId: STORE_ID } })
  if (!products.data?.data?.length) {
    console.error('\n❌ No products found in store. Please create them first:')
    console.error('   1. "StackPulse Pro" — subscription, 2 variants: Monthly $4.99, Yearly $49.99')
    console.error('   2. "StackPulse Business" — subscription, 2 variants: Monthly $19.99, Yearly $199.99')
    console.error('\n   Dashboard: https://app.lemonsqueezy.com/products')
    process.exit(1)
  }

  for (const p of products.data.data) {
    console.log(`  [${p.id}] ${p.attributes.name} (${p.attributes.status}) — ${p.attributes.price_formatted}`)
  }

  // 2. List variants
  console.log('\n── Variants ──────────────────────────────')
  const variants = await listVariants({ filter: { productId: undefined } })
  const allVariants = variants.data?.data ?? []

  // Filter to our store's products
  const productIds = new Set(products.data.data.map((p: any) => p.id))
  const storeVariants = allVariants.filter((v: any) => {
    // Variant's product relationship
    return true // list all for now
  })

  // Price-based auto-detection
  const detected = {
    proMonthly: null as string | null,
    proYearly: null as string | null,
    businessMonthly: null as string | null,
    businessYearly: null as string | null,
  }

  for (const v of allVariants) {
    const price = v.attributes.price // price in cents
    const interval = v.attributes.interval // 'month' or 'year'
    const name = v.attributes.name?.toLowerCase() ?? ''
    console.log(`  [${v.id}] ${v.attributes.name} — $${(price / 100).toFixed(2)}/${interval ?? 'one-time'} (product ${v.attributes.product_id})`)

    // Auto-detect by price
    if (price === 499 && interval === 'month') detected.proMonthly = v.id
    else if (price === 4999 && interval === 'year') detected.proYearly = v.id
    else if (price === 1999 && interval === 'month') detected.businessMonthly = v.id
    else if (price === 19999 && interval === 'year') detected.businessYearly = v.id
    // Fallback: detect by name
    else if (name.includes('pro') && interval === 'month') detected.proMonthly ??= v.id
    else if (name.includes('pro') && interval === 'year') detected.proYearly ??= v.id
    else if (name.includes('business') && interval === 'month') detected.businessMonthly ??= v.id
    else if (name.includes('business') && interval === 'year') detected.businessYearly ??= v.id
  }

  // 3. Setup webhook
  console.log('\n── Webhook ───────────────────────────────')
  const webhookUrl = `${APP_URL}/api/webhooks/lemonsqueezy`

  // Check existing webhooks
  const existingWebhooks = await listWebhooks({ filter: { storeId: STORE_ID } })
  const existing = existingWebhooks.data?.data?.find(
    (w: any) => w.attributes.url === webhookUrl
  )

  let webhookSecret = envVars.LEMONSQUEEZY_WEBHOOK_SECRET
  if (existing) {
    console.log(`  Webhook already exists: ${existing.attributes.url}`)
    console.log(`  (Use existing LEMONSQUEEZY_WEBHOOK_SECRET from .env.local)`)
  } else {
    // Generate a random secret
    const crypto = await import('node:crypto')
    webhookSecret = crypto.randomBytes(32).toString('hex')

    try {
      const webhook = await createWebhook(STORE_ID, {
        url: webhookUrl,
        events: [
          'subscription_created',
          'subscription_updated',
          'subscription_cancelled',
          'subscription_expired',
          'subscription_resumed',
          'subscription_paused',
        ],
        secret: webhookSecret,
      })
      console.log(`  Created webhook: ${webhook.data?.data?.attributes?.url}`)
      console.log(`  Events: subscription_created, subscription_updated, subscription_cancelled, subscription_expired`)
    } catch (err: any) {
      console.error(`  ⚠️  Failed to create webhook: ${err.message}`)
      console.error(`  You may need to create it manually at: https://app.lemonsqueezy.com/settings/webhooks`)
      console.error(`  URL: ${webhookUrl}`)
    }
  }

  // 4. Output env vars
  console.log('\n── Environment Variables ──────────────────')
  console.log('Add these to .env.local:\n')

  const envLines = [
    `LEMONSQUEEZY_API_KEY=${API_KEY}`,
    `LEMONSQUEEZY_STORE_ID=${STORE_ID}`,
    `LEMONSQUEEZY_WEBHOOK_SECRET=${webhookSecret ?? 'SET_ME'}`,
    `LS_PRO_MONTHLY_VARIANT_ID=${detected.proMonthly ?? 'NOT_FOUND'}`,
    `LS_PRO_YEARLY_VARIANT_ID=${detected.proYearly ?? 'NOT_FOUND'}`,
    `LS_BUSINESS_MONTHLY_VARIANT_ID=${detected.businessMonthly ?? 'NOT_FOUND'}`,
    `LS_BUSINESS_YEARLY_VARIANT_ID=${detected.businessYearly ?? 'NOT_FOUND'}`,
  ]

  for (const line of envLines) {
    console.log(`  ${line}`)
  }

  const missing = Object.entries(detected).filter(([, v]) => !v)
  if (missing.length > 0) {
    console.log(`\n⚠️  Could not auto-detect ${missing.length} variant(s):`)
    for (const [key] of missing) {
      const friendly: Record<string, string> = {
        proMonthly: 'Pro Monthly ($4.99/mo)',
        proYearly: 'Pro Yearly ($49.99/yr)',
        businessMonthly: 'Business Monthly ($19.99/mo)',
        businessYearly: 'Business Yearly ($199.99/yr)',
      }
      console.log(`   - ${friendly[key] ?? key}`)
    }
    console.log('\nPlease create the missing variants in the Lemon Squeezy dashboard,')
    console.log('then re-run this script.\n')
  } else {
    console.log('\n✅ All 4 variants detected! Copy the above to .env.local\n')
  }
}

main().catch(console.error)
