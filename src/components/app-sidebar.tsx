'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, LogOut, Clock, Bell } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'
import { Button } from '@/components/ui/button'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

interface SidebarService {
  id: string
  label: string
  providerId: string
  status: Status
}

interface AppSidebarProps {
  services: SidebarService[]
  userEmail: string
}

const STATUS_COLORS: Record<Status, string> = {
  healthy:  'bg-emerald-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
  unknown:  'bg-zinc-600',
}

const NAV_LINKS = [
  { label: 'History', href: '/dashboard/history', icon: Clock },
  { label: 'Channels', href: '/dashboard/channels', icon: Bell },
]

const PROVIDER_INITIALS: Record<string, string> = {
  openrouter: 'OR',
  resend:     'RS',
  sentry:     'SN',
}

export function AppSidebar({ services, userEmail }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
            SP
          </span>
          <span className="font-semibold text-sm text-foreground group-hover:text-emerald-400 transition-colors">
            StackPulse
          </span>
        </Link>
      </div>

      {/* Services */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {services.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-2">No services connected</p>
        ) : (
          services.map((service) => {
            const isActive = pathname.startsWith('/dashboard/' + service.id)
            return (
              <Link
                key={service.id}
                href={'/dashboard/' + service.id}
                className={`
                  flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm
                  transition-colors relative group
                  ${isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-emerald-500 rounded-full" />
                )}
                {/* Status dot */}
                <span className="relative flex h-2 w-2 shrink-0">
                  {(service.status === 'healthy' || service.status === 'warning') && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${STATUS_COLORS[service.status]}`} />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${STATUS_COLORS[service.status]}`} />
                </span>
                {/* Provider initials badge */}
                <span className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                  {PROVIDER_INITIALS[service.providerId] ?? service.providerId.slice(0, 2).toUpperCase()}
                </span>
                {/* Name */}
                <span className="truncate">{service.label}</span>
              </Link>
            )
          })
        )}
      </nav>

      {/* Navigation links */}
      <div className="px-2">
        <div className="border-t border-border my-2" />
        <div className="space-y-0.5">
          {NAV_LINKS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                ${pathname === href
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <Link href="/connect">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground border-border"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Service
          </Button>
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
            {userEmail[0]?.toUpperCase()}
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">{userEmail}</span>
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
