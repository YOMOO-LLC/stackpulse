'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, CheckCircle, MessageSquare, Lock } from 'lucide-react'

interface Channel {
  type: string
  config: Record<string, string>
  isDefault?: boolean
  enabled?: boolean
}

export default function ChannelsPage() {
  const [testSent, setTestSent] = useState(false)
  const [sending, setSending] = useState(false)

  // Slack state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackSaveError, setSlackSaveError] = useState('')
  const [slackSaved, setSlackSaved] = useState(false)
  const [slackTestSent, setSlackTestSent] = useState(false)
  const [slackTesting, setSlackTesting] = useState(false)
  const [slackConnected, setSlackConnected] = useState(false)
  const [planBlocked, setPlanBlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/channels')
      if (!res.ok) return
      const data = await res.json()
      const slackCh = data.channels?.find((c: Channel) => c.type === 'slack')
      if (slackCh) {
        setSlackWebhookUrl(slackCh.config.webhook_url || '')
        setSlackConnected(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  async function sendEmailTest() {
    setSending(true)
    try {
      await fetch('/api/channels/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3000)
    } finally {
      setSending(false)
    }
  }

  async function saveSlackWebhook() {
    setSlackSaving(true)
    setSlackSaveError('')
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'slack', config: { webhook_url: slackWebhookUrl } }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          setPlanBlocked(true)
        }
        setSlackSaveError(data.error || 'Failed to save')
        return
      }
      setSlackSaved(true)
      setSlackConnected(true)
      setTimeout(() => setSlackSaved(false), 3000)
    } finally {
      setSlackSaving(false)
    }
  }

  async function sendSlackTest() {
    setSlackTesting(true)
    try {
      await fetch('/api/channels/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'slack' }),
      })
      setSlackTestSent(true)
      setTimeout(() => setSlackTestSent(false), 3000)
    } finally {
      setSlackTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-foreground mb-6">Notification Channels</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground mb-6">Notification Channels</h1>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Email</h2>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Account Email</p>
                <p className="text-xs text-muted-foreground">Alerts sent to your account email address</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {testSent && (
                <span className="text-xs text-emerald-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Sent!
                </span>
              )}
              <Button size="sm" variant="outline" onClick={sendEmailTest} disabled={sending}>
                {sending ? 'Sending...' : 'Send test alert'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Slack</h2>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Slack Incoming Webhook</p>
              <p className="text-xs text-muted-foreground">Receive alert notifications in a Slack channel</p>
            </div>
          </div>

          {planBlocked ? (
            <div className="flex items-center gap-2 p-3 bg-zinc-800 rounded-lg">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Slack notifications require a Pro or Business plan.
              </span>
              <a href="/dashboard/billing" className="text-sm text-primary hover:underline ml-auto">
                Upgrade
              </a>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  type="url"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="sm"
                  onClick={saveSlackWebhook}
                  disabled={slackSaving || !slackWebhookUrl}
                >
                  {slackSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>

              {slackSaveError && (
                <p className="text-xs text-red-500 mb-2">{slackSaveError}</p>
              )}
              {slackSaved && (
                <p className="text-xs text-emerald-500 flex items-center gap-1 mb-2">
                  <CheckCircle className="h-3 w-3" /> Saved!
                </p>
              )}

              {slackConnected && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Connected
                  </span>
                  <div className="flex items-center gap-2">
                    {slackTestSent && (
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Sent!
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={sendSlackTest} disabled={slackTesting}>
                      {slackTesting ? 'Sending...' : 'Send test alert'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Coming Soon</h2>
        <div className="space-y-2">
          {['Discord', 'Custom Webhook'].map((name) => (
            <div key={name} className="bg-card border border-border rounded-lg p-4 opacity-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
