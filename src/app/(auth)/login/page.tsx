'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signInWithEmail, signUpWithEmail } from './actions'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const result = mode === 'login'
        ? await signInWithEmail(formData)
        : await signUpWithEmail(formData)
      if (result && 'error' in result) setMessage(result.error ?? '')
      else if (result && 'message' in result) setMessage(result.message ?? '')
    } finally {
      setPending(false)
    }
  }

  const isError = !!message && (
    message.includes('failed') ||
    message.includes('Invalid') ||
    message.includes('invalid') ||
    message.includes('error') ||
    message.includes('Error')
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
            SP
          </span>
          <span className="text-lg font-semibold text-foreground">StackPulse</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            {mode === 'login' ? 'Welcome back' : 'Start monitoring your API services'}
          </p>

          <form action={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input
                id="email" name="email" type="email" required
                autoComplete="email"
                placeholder="you@example.com"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
              <Input
                id="password" name="password" type="password" required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/40"
              />
            </div>

            {message && (
              <p className={`text-xs px-3 py-2 rounded-md ${
                isError
                  ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                  : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                {message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={pending}
            >
              {pending ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}
            className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
