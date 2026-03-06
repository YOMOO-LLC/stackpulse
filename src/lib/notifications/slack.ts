const CONDITION_LABELS: Record<string, string> = {
  lt: 'dropped below',
  gt: 'exceeded',
  eq: 'equals',
  status_is: 'status changed to',
}

export interface AlertPayload {
  serviceName: string
  collectorName: string
  condition: string
  threshold: number | string
  triggeredValue: number | string
  serviceId: string
}

export async function sendSlackAlert(webhookUrl: string, alert: AlertPayload): Promise<void> {
  const { serviceName, collectorName, condition, threshold, triggeredValue, serviceId } = alert
  const conditionLabel = CONDITION_LABELS[condition] ?? condition
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Alert: ${collectorName} on ${serviceName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Service:*\n${serviceName}` },
        { type: 'mrkdwn', text: `*Metric:*\n${collectorName}` },
        { type: 'mrkdwn', text: `*Condition:*\n${conditionLabel} ${threshold}` },
        { type: 'mrkdwn', text: `*Current Value:*\n${triggeredValue}` },
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Triggered at ${new Date().toUTCString()}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Service' },
          url: `${appUrl}/dashboard/${serviceId}`,
          style: 'primary',
        },
      ],
    },
  ]

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
  } catch {
    console.error('[sendSlackAlert] Failed to send Slack alert')
  }
}
