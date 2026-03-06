import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Demo | StackPulse',
  description:
    'Interactive API monitoring demo — see how StackPulse tracks GitHub, Stripe, OpenAI, and Vercel metrics with sample data. No sign-up required.',
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
