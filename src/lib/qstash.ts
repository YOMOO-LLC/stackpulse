import { Client } from '@upstash/qstash'
import { getUserPlan } from '@/lib/subscription'

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
  ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}),
})
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

export async function registerServiceSchedule(serviceId: string, userId: string): Promise<string> {
  const { limits } = await getUserPlan(userId)

  const result = await qstash.schedules.create({
    destination: `${APP_URL}/api/cron/poll-service`,
    cron: limits.pollCron,
    body: JSON.stringify({ serviceId }),
    headers: { 'Content-Type': 'application/json' },
  })
  return result.scheduleId
}

export async function unregisterServiceSchedule(scheduleId: string | null): Promise<void> {
  if (!scheduleId) return
  try {
    await qstash.schedules.delete(scheduleId)
  } catch {
    console.error('[qstash] Failed to delete schedule', scheduleId)
  }
}
