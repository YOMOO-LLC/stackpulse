import { describe, it, expect, vi } from 'vitest'

const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue({ id: 'email-1' })
  return { mockSend }
})

vi.mock('resend', () => {
  return {
    Resend: class {
      emails = { send: mockSend }
    },
  }
})

import { sendAlertEmail } from '../email'

describe('sendAlertEmail', () => {
  it('calls Resend with correct recipient and subject', async () => {
    mockSend.mockResolvedValue({ id: 'email-1' })
    await sendAlertEmail({
      to: 'user@example.com',
      serviceName: 'OpenRouter',
      collectorName: 'Credit Balance',
      condition: 'lt',
      threshold: 5,
      triggeredValue: 3.47,
      serviceId: 'svc-1',
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('OpenRouter'),
      })
    )
  })

  it('does not throw if Resend fails', async () => {
    mockSend.mockRejectedValue(new Error('network'))
    await expect(
      sendAlertEmail({
        to: 'user@example.com',
        serviceName: 'OpenRouter',
        collectorName: 'Credit Balance',
        condition: 'lt',
        threshold: 5,
        triggeredValue: 3.47,
        serviceId: 'svc-1',
      })
    ).resolves.not.toThrow()
  })
})
