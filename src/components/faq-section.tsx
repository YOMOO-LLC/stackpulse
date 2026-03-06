'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is StackPulse?',
    answer:
      'StackPulse is an API monitoring dashboard that tracks rate limits, credit balances, error counts, and deployment status across all your SaaS dependencies — GitHub, Stripe, OpenAI, Vercel, and more — from a single pane of glass.',
  },
  {
    question: 'How does StackPulse work?',
    answer:
      'Connect your services via OAuth or API key. StackPulse automatically polls each provider every 5 to 60 minutes, collects key metrics, and evaluates your alert rules. If a threshold is breached, you get notified via email or Slack in under 30 seconds.',
  },
  {
    question: 'Is StackPulse free?',
    answer:
      'Yes! The Free plan lets you monitor up to 3 services with hourly polling and 7-day metric retention — no credit card required. When you need more services or faster polling, upgrade to Pro or Business.',
  },
  {
    question: 'How fast are alerts?',
    answer:
      'Alert latency is under 30 seconds from the moment a threshold is breached. StackPulse evaluates your alert rules on every polling cycle and sends notifications immediately when conditions are met, with smart cooldowns to prevent alert fatigue.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. All stored credentials are encrypted with AES-256-GCM. OAuth tokens are automatically rotated, and services auto-disable after 5 consecutive failures to prevent cascading issues. We never store your raw API keys in plaintext.',
  },
  {
    question: 'What providers do you support?',
    answer:
      'StackPulse supports 11 providers: GitHub, Stripe, Vercel, Sentry, OpenAI, OpenRouter, Resend, Upstash Redis, Upstash QStash, MiniMax, and Supabase. We are continuously adding new integrations based on user feedback.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees. When you cancel, you keep access to your paid features until the end of your current billing period, then your account reverts to the Free plan.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section
      id="faq"
      className="flex flex-col items-center px-14 py-20"
      style={{ background: 'var(--background)' }}
    >
      <span
        className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
        style={{ background: 'var(--sp-success-muted)', color: 'var(--primary)' }}
      >
        FAQ
      </span>

      <h2
        className="text-4xl font-bold text-center mb-4 max-w-xl"
        style={{ color: 'var(--foreground)' }}
      >
        Frequently Asked Questions
      </h2>
      <p
        className="text-base text-center leading-relaxed mb-14 max-w-2xl"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Everything you need to know about StackPulse. Can&apos;t find an answer?
        Reach out to our team.
      </p>

      <div className="w-full max-w-3xl flex flex-col gap-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <div
              key={item.question}
              className="rounded-xl"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-6 py-5 text-left"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
              >
                <span
                  className="font-medium text-sm"
                  style={{ color: 'var(--foreground)' }}
                >
                  {item.question}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--muted-foreground)' }}
                />
              </button>
              <div
                data-faq-answer=""
                className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96' : 'max-h-0'}`}
              >
                <p
                  className="px-6 pb-5 text-sm leading-relaxed"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {item.answer}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** JSON-LD FAQPage schema for SEO */
export const faqJsonLd = {
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}
