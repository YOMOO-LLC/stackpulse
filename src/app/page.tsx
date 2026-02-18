import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProviderIcon } from '@/components/provider-icon'

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'resend', name: 'Resend' },
  { id: 'sentry', name: 'Sentry' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'github', name: 'GitHub' },
  { id: 'vercel', name: 'Vercel' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'upstash', name: 'Upstash' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">SP</span>
          <span className="font-semibold text-sm text-foreground">StackPulse</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-8 py-24">
        <h1 className="text-4xl font-bold text-foreground mb-4 max-w-lg leading-tight">
          Monitor all your API services in one place.
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">
          Credits, errors, status — get alerted by email before your users notice.
        </p>
        <Button size="lg" asChild>
          <Link href="/login">Connect your first service &rarr;</Link>
        </Button>

        <div className="flex items-center gap-4 mt-16 flex-wrap justify-center">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1.5">
              <ProviderIcon providerId={p.id} size={36} />
              <span className="text-xs text-muted-foreground">{p.name}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
