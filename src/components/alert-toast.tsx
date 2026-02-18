'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ToastMessage {
  id: string
  text: string
}

export function AlertToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('alert-events-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alert_events',
      }, (payload) => {
        const msg: ToastMessage = {
          id: payload.new.id as string,
          text: 'Alert triggered',
        }
        setToasts((t) => [...t, msg])
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== msg.id))
        }, 5000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div key={toast.id} className="flex items-center gap-2 bg-card border border-amber-800 text-amber-400 rounded-lg px-4 py-3 shadow-lg text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {toast.text}
        </div>
      ))}
    </div>
  )
}
