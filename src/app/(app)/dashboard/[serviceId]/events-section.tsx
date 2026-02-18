'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AlertEvent {
  id: string
  notified_at: string
  triggered_value_numeric: number | null
  triggered_value_text: string | null
  alert_configs: {
    collector_id: string
    condition: string
    threshold_numeric: number | null
  } | null
}

interface EventsSectionProps {
  serviceId: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatTriggeredValue(event: AlertEvent): string {
  if (event.triggered_value_numeric != null) {
    const threshold = event.alert_configs?.threshold_numeric
    if (threshold != null && threshold < 1000) {
      return `$${event.triggered_value_numeric.toFixed(2)}`
    }
    return String(event.triggered_value_numeric)
  }
  return event.triggered_value_text ?? ''
}

export function EventsSection({ serviceId }: EventsSectionProps) {
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  async function loadEvents(currentOffset: number) {
    setLoading(true)
    const res = await fetch(`/api/alert-events?serviceId=${serviceId}&offset=${currentOffset}`)
    if (res.ok) {
      const json = await res.json()
      if (currentOffset === 0) {
        setEvents(json.events)
      } else {
        setEvents((prev) => [...prev, ...json.events])
      }
      setHasMore(json.hasMore)
    }
    setLoading(false)
  }

  useEffect(() => { loadEvents(0) }, [serviceId])

  function loadMore() {
    const newOffset = offset + 20
    setOffset(newOffset)
    loadEvents(newOffset)
  }

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">RECENT EVENTS</h2>

      {!loading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">No alerts have triggered for this service.</p>
      )}

      <div className="space-y-1">
        {events.map((event) => {
          const isCritical = event.alert_configs?.condition === 'gt'
          return (
            <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              {isCritical
                ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              }
              <span className="text-xs text-muted-foreground shrink-0 w-36">
                {formatDate(event.notified_at)}
              </span>
              <span className="text-sm text-foreground flex-1">
                {event.alert_configs?.collector_id?.replace(/_/g, ' ') ?? 'Unknown'} triggered
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatTriggeredValue(event)}
              </span>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading\u2026' : 'Load more'}
          </Button>
        </div>
      )}
    </section>
  )
}
