'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button className="p-1.5 rounded-md" aria-label="Toggle theme">
        <Sun className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
      </button>
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-1.5 rounded-md transition-colors hover:bg-accent"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
      ) : (
        <Moon className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
      )}
    </button>
  )
}
