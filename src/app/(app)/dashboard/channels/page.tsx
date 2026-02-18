'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, CheckCircle } from 'lucide-react'

export default function ChannelsPage() {
  const [testSent, setTestSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function sendTest() {
    setSending(true)
    try {
      await fetch('/api/channels/test', { method: 'POST' })
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3000)
    } finally {
      setSending(false)
    }
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
              <Button size="sm" variant="outline" onClick={sendTest} disabled={sending}>
                {sending ? 'Sending...' : 'Send test alert'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Coming Soon</h2>
        <div className="space-y-2">
          {['Slack', 'Discord', 'Custom Webhook'].map((name) => (
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
