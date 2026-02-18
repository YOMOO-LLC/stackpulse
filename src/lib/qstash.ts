import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

export async function registerServiceSchedule(serviceId: string): Promise<string> {
  const result = await qstash.schedules.create({
    destination: `${APP_URL}/api/cron/poll-service`,
    cron: '*/5 * * * *',
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
