import { ImageResponse } from 'next/og'

export const alt = 'StackPulse — API Monitoring Dashboard for SaaS Dependencies'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            SP
          </div>
          <span style={{ color: '#fafafa', fontSize: 32, fontWeight: 600 }}>
            StackPulse
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            maxWidth: 800,
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#fafafa', fontSize: 52, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            API Monitoring Dashboard
          </h1>
          <p style={{ color: '#10b981', fontSize: 36, fontWeight: 600, margin: 0 }}>
            Know Before Your Users Do
          </p>
          <p style={{ color: '#a1a1aa', fontSize: 22, margin: 0, lineHeight: 1.5 }}>
            Monitor rate limits, credit balances, and deployment status across GitHub, Stripe, OpenAI, Vercel, and more.
          </p>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            gap: 48,
            marginTop: 48,
          }}
        >
          {[
            { value: '11', label: 'Providers' },
            { value: '<30s', label: 'Alert Latency' },
            { value: '$0', label: 'Free Tier' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ color: '#10b981', fontSize: 28, fontWeight: 700 }}>
                {stat.value}
              </span>
              <span style={{ color: '#71717a', fontSize: 16 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
