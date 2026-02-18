interface ProviderIconProps {
  providerId: string
  size?: number
  className?: string
}

const PROVIDER_FALLBACK_COLOR: Record<string, string> = {
  openrouter: 'bg-emerald-900 text-emerald-400',
  resend:     'bg-zinc-800 text-zinc-300',
  sentry:     'bg-violet-900 text-violet-400',
}

const PROVIDER_INITIALS: Record<string, string> = {
  openrouter: 'OR',
  resend:     'Re',
  sentry:     'Sn',
}

export function ProviderIcon({ providerId, size = 32, className = '' }: ProviderIconProps) {
  const fallbackColor = PROVIDER_FALLBACK_COLOR[providerId] ?? 'bg-zinc-800 text-zinc-400'
  const initials = PROVIDER_INITIALS[providerId] ?? providerId.slice(0, 2).toUpperCase()

  return (
    <div
      className={`rounded-md overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/icons/${providerId}.svg`}
        alt={providerId}
        width={size}
        height={size}
        className="rounded-md"
        onError={(e) => {
          const target = e.currentTarget
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            parent.className = `rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${fallbackColor} ${className}`
            parent.textContent = initials
          }
        }}
      />
    </div>
  )
}
