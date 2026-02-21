'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signInWithEmail, signUpWithEmail } from './actions'
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode]       = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const result = mode === 'login'
        ? await signInWithEmail(formData)
        : await signUpWithEmail(formData)
      if (result && 'error'   in result) setMessage(result.error   ?? '')
      if (result && 'message' in result) setMessage(result.message ?? '')
    } finally {
      setPending(false)
    }
  }

  const isError = !!message && /fail|invalid|error/i.test(message)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Left: Brand Panel ───────────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-1/2 flex-col justify-between px-14 py-15"
        style={{ background: '#08080C' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            SP
          </span>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            StackPulse
          </span>
        </div>

        {/* Illustration + Testimonial */}
        <div className="flex flex-col gap-7">

          {/* Isometric tech illustration */}
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: '1px solid #1E1E2A' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/login-illustration.png"
              alt="StackPulse infrastructure monitoring illustration"
              className="w-full block"
              draggable={false}
            />
          </div>

          {/* Testimonial */}
          <div className="flex flex-col gap-5">
            <blockquote
              className="text-xl font-medium leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            >
              &ldquo;StackPulse saved us hours of manual monitoring. We now catch issues
              before our customers do.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'var(--sp-success-muted)', color: 'var(--primary)' }}
              >
                A
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Alex Chen
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  CTO, TechFlow Inc.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>99.9%</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Uptime SLA</span>
          </div>
          <div className="w-px h-8" style={{ background: 'var(--border)' }} />
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>500+</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Teams</span>
          </div>
        </div>
      </div>

      {/* ── Right: Form Panel ───────────────────────────────────────────── */}
      <div
        className="flex flex-1 items-center justify-center px-8 py-15"
        style={{ background: 'var(--card)' }}
      >
        <div className="w-full max-w-[400px] flex flex-col gap-7">

          {/* Heading */}
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {mode === 'login'
                ? 'Sign in to your StackPulse account'
                : 'Start monitoring your API services today'}
            </p>
          </div>

          {/* Form */}
          <form action={handleSubmit} className="flex flex-col gap-5">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm" style={{ color: 'var(--foreground)' }}>
                Email
              </Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <Input
                  id="email" name="email" type="email" required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  style={{
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm" style={{ color: 'var(--foreground)' }}>
                  Password
                </Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="text-xs"
                    style={{ color: 'var(--primary)' }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <Input
                  id="password" name="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  style={{
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw
                    ? <EyeOff className="size-4" />
                    : <Eye    className="size-4" />}
                </button>
              </div>
            </div>

            {/* Status message */}
            {message && (
              <p
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  color:      isError ? 'var(--sp-error)'   : 'var(--sp-success)',
                  background: isError ? 'var(--sp-error-muted)' : 'var(--sp-success-muted)',
                  border:     `1px solid ${isError ? '#EF444433' : '#10B98133'}`,
                }}
              >
                {message}
              </p>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                'Loading…'
              ) : mode === 'login' ? (
                <>
                  <Zap className="size-4" />
                  Sign In
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          {/* Mode toggle */}
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}
              className="font-medium"
              style={{ color: 'var(--primary)' }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

        </div>
      </div>

    </div>
  )
}
