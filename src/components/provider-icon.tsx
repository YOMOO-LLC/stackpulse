'use client'

import {
  SiGithub,
  SiStripe,
  SiVercel,
  SiSentry,
  SiResend,
  SiOpenrouter,
  SiUpstash,
  SiMinimax,
  SiSupabase,
} from '@icons-pack/react-simple-icons'

interface ProviderIconProps {
  providerId: string
  size?: number
  className?: string
}

// Brand background colors
const PROVIDER_BG: Record<string, string> = {
  github:           '#24292E',
  stripe:           '#6772E5',
  vercel:           '#000000',
  openai:           '#10a37f',
  sentry:           '#362D59',
  resend:           '#18181B',
  openrouter:       '#0D1117',
  'upstash-redis':  '#1E0A3C',
  'upstash-qstash': '#1E0A3C',
  minimax:          '#000000',
  supabase:         '#1C1C1C',
}

type IconComponent = React.ComponentType<{ size?: number; color?: string }>

const PROVIDER_ICON: Record<string, { Icon: IconComponent; color: string }> = {
  github:           { Icon: SiGithub,     color: '#ffffff' },
  stripe:           { Icon: SiStripe,     color: '#ffffff' },
  vercel:           { Icon: SiVercel,     color: '#ffffff' },
  sentry:           { Icon: SiSentry,     color: '#A07BD4' },
  resend:           { Icon: SiResend,     color: '#E4E4E7' },
  openrouter:       { Icon: SiOpenrouter, color: '#10B981' },
  'upstash-redis':  { Icon: SiUpstash,    color: '#00E9A3' },
  'upstash-qstash': { Icon: SiUpstash,    color: '#00E9A3' },
  minimax:          { Icon: SiMinimax,    color: '#ffffff' },
  supabase:         { Icon: SiSupabase,   color: '#3ECF8E' },
}

export function ProviderIcon({ providerId, size = 32, className = '' }: ProviderIconProps) {
  const bg = PROVIDER_BG[providerId] ?? '#1A1A24'
  const radius = Math.round(size * 0.25)
  const iconSize = Math.round(size * 0.55)
  const entry = PROVIDER_ICON[providerId]

  if (entry) {
    const { Icon, color } = entry
    return (
      <div
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size, borderRadius: radius, background: bg }}
      >
        <Icon size={iconSize} color={color} />
      </div>
    )
  }

  // Fallback: text initials for unknown providers
  const initials = providerId.slice(0, 2).toUpperCase()
  const fontSize = Math.round(size * 0.32)
  return (
    <div
      className={`flex items-center justify-center shrink-0 font-bold ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        color: '#8888A0',
        fontSize,
      }}
    >
      {initials}
    </div>
  )
}
