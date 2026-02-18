import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const CONDITION_LABELS: Record<string, string> = {
  lt: 'dropped below',
  gt: 'exceeded',
  eq: 'equals',
  status_is: 'status changed to',
}

interface AlertEmailParams {
  to: string
  serviceName: string
  collectorName: string
  condition: string
  threshold: number | string
  triggeredValue: number | string
  serviceId: string
}

export async function sendAlertEmail(params: AlertEmailParams): Promise<void> {
  const { to, serviceName, collectorName, condition, threshold, triggeredValue, serviceId } = params
  const conditionLabel = CONDITION_LABELS[condition] ?? condition
  const thresholdStr = typeof threshold === 'number' && condition === 'lt' ? `$${threshold}` : String(threshold)
  const valueStr = typeof triggeredValue === 'number' && condition === 'lt' ? `$${triggeredValue.toFixed(2)}` : String(triggeredValue)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

  try {
    await resend.emails.send({
      from: 'StackPulse Alerts <alerts@stackpulse.app>',
      to,
      subject: `[StackPulse] Alert: ${collectorName} on ${serviceName}`,
      html: `
        <div style="font-family: monospace; max-width: 520px; margin: 0 auto; padding: 32px; background: #09090b; color: #fafafa;">
          <h2 style="color: #f59e0b; margin: 0 0 24px;">Alert Triggered</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #71717a;">Service</td><td>${serviceName}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Metric</td><td>${collectorName}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Condition</td><td>${conditionLabel} ${thresholdStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Current value</td><td style="color: #ef4444; font-weight: bold;">${valueStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Triggered at</td><td>${new Date().toUTCString()}</td></tr>
          </table>
          <div style="margin-top: 32px;">
            <a href="${appUrl}/dashboard/${serviceId}"
               style="background: #10b981; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
              View service
            </a>
          </div>
        </div>
      `,
    })
  } catch {
    console.error('[sendAlertEmail] Failed to send alert email')
  }
}
