#!/usr/bin/env npx tsx
/**
 * Re-register QStash schedules for all enabled connected services.
 *
 * Use this after restarting the QStash dev server, which loses all
 * in-memory schedules and regenerates its auth token.
 *
 * Usage:
 *   npx tsx --env-file .env.local scripts/reregister-schedules.ts
 *
 * Requires env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   QSTASH_TOKEN
 *   QSTASH_URL           (optional, for local dev server)
 *   NEXT_PUBLIC_APP_URL
 */

import { createClient } from '@supabase/supabase-js'
import { Client } from '@upstash/qstash'
// Env vars loaded via: npx tsx --env-file .env.local

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const QSTASH_TOKEN = process.env.QSTASH_TOKEN!
const QSTASH_URL = process.env.QSTASH_URL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

// Plan limits (mirrored from src/lib/subscription.ts to avoid path alias issues)
const PLAN_CRON: Record<string, string> = {
  free: '0 * * * *',
  pro: '*/15 * * * *',
  business: '*/5 * * * *',
}

async function main() {
  console.log('🔄 Re-registering QStash schedules...\n')
  console.log(`   Supabase: ${SUPABASE_URL}`)
  console.log(`   QStash:   ${QSTASH_URL ?? 'https://qstash.upstash.io'}`)
  console.log(`   App URL:  ${APP_URL}\n`)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const qstash = new Client({
    token: QSTASH_TOKEN,
    ...(QSTASH_URL ? { baseUrl: QSTASH_URL } : {}),
  })

  // 1. Fetch all enabled services
  const { data: services, error } = await supabase
    .from('connected_services')
    .select('id, provider_id, user_id, qstash_schedule_id, enabled')
    .eq('enabled', true)

  if (error) {
    console.error('❌ Failed to fetch services:', error.message)
    process.exit(1)
  }

  if (!services || services.length === 0) {
    console.log('No enabled services found.')
    process.exit(0)
  }

  console.log(`Found ${services.length} enabled services.\n`)

  // 2. Get user plans (batch unique user IDs)
  const userIds = [...new Set(services.map((s) => s.user_id))]
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id, plan')
    .in('user_id', userIds)

  const userPlanMap = new Map<string, string>()
  for (const sub of subscriptions ?? []) {
    userPlanMap.set(sub.user_id, sub.plan)
  }

  // 3. Try to clean up old schedules first
  console.log('Cleaning up old schedules...')
  try {
    const existing = await qstash.schedules.list()
    if (existing.length > 0) {
      for (const schedule of existing) {
        try {
          await qstash.schedules.delete(schedule.scheduleId)
        } catch { /* ignore */ }
      }
      console.log(`   Deleted ${existing.length} old schedules.\n`)
    } else {
      console.log('   No old schedules found.\n')
    }
  } catch {
    console.log('   Could not list old schedules (may be a fresh server).\n')
  }

  // 4. Re-register each service
  let success = 0
  let failed = 0

  for (const service of services) {
    const plan = userPlanMap.get(service.user_id) ?? 'free'
    const cron = PLAN_CRON[plan] ?? PLAN_CRON.free

    try {
      const result = await qstash.schedules.create({
        destination: `${APP_URL}/api/cron/poll-service`,
        cron,
        body: JSON.stringify({ serviceId: service.id }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Update the schedule ID in the database
      await supabase
        .from('connected_services')
        .update({ qstash_schedule_id: result.scheduleId })
        .eq('id', service.id)

      console.log(`   ✅ ${service.provider_id} (${service.id.slice(0, 8)}...) → ${result.scheduleId} [${cron}]`)
      success++
    } catch (err) {
      console.error(`   ❌ ${service.provider_id} (${service.id.slice(0, 8)}...): ${err}`)
      failed++
    }
  }

  console.log(`\n🏁 Done: ${success} registered, ${failed} failed.`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
