import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendSlackAlert } from '../slack'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('sendSlackAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true })
  })

  const basePayload = {
    serviceName: 'OpenRouter',
    collectorName: 'Credit Balance',
    condition: 'lt',
    threshold: 5,
    triggeredValue: 3.47,
    serviceId: 'svc-1',
  }

  it('sends a POST request to the provided webhook URL', async () => {
    await sendSlackAlert('https://hooks.slack.com/services/T00/B00/xxx', basePayload)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('sends Block Kit formatted message with service name and metric info', async () => {
    await sendSlackAlert('https://hooks.slack.com/services/T00/B00/xxx', basePayload)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.blocks).toBeDefined()
    expect(Array.isArray(body.blocks)).toBe(true)

    const text = JSON.stringify(body.blocks)
    expect(text).toContain('OpenRouter')
    expect(text).toContain('Credit Balance')
    expect(text).toContain('3.47')
  })

  it('includes condition label in the message', async () => {
    await sendSlackAlert('https://hooks.slack.com/services/T00/B00/xxx', {
      ...basePayload,
      condition: 'gt',
      threshold: 100,
      triggeredValue: 150,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const text = JSON.stringify(body.blocks)
    expect(text).toContain('exceeded')
  })

  it('does not throw when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))

    await expect(
      sendSlackAlert('https://hooks.slack.com/services/T00/B00/xxx', basePayload)
    ).resolves.not.toThrow()
  })

  it('does not throw when webhook returns non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(
      sendSlackAlert('https://hooks.slack.com/services/T00/B00/xxx', basePayload)
    ).resolves.not.toThrow()
  })
})
