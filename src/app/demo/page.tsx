import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Auto-executes demo login and redirects to /dashboard
// Used as a public shareable shortlink
export default async function DemoPage() {
  const email    = process.env.NEXT_PUBLIC_DEMO_EMAIL
  const password = process.env.DEMO_USER_PASSWORD

  if (!email || !password) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Fall through to login page with hint
    redirect('/login?demo=error')
  }

  redirect('/dashboard')
}
