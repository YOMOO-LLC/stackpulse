# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (port 4567)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

Dev server: http://localhost:4567 (not the default port 3000)

## Tech Stack

- **Next.js 16.1.6** (App Router) + **React 19.2.3**
- **TypeScript** (strict mode)
- **Tailwind CSS v4** (`@import "tailwindcss"` syntax — not the legacy `@tailwind` directives)
- Fonts: Geist Sans + Geist Mono (loaded via `next/font/google`)

## Architecture

Next.js App Router with source under `src/`:

- `src/app/layout.tsx` — Root layout; sets font CSS variables and global styles
- `src/app/globals.css` — Global styles; defines CSS custom properties and Tailwind theme config
- `src/app/(auth)/login/` — Login/signup page (no sidebar)
- `src/app/(app)/` — Authenticated route group with shared sidebar layout
  - `dashboard/` — Service monitoring overview
  - `connect/` — Provider selection and API key form
- `src/components/app-sidebar.tsx` — Fixed left sidebar with service list and status dots
- `src/components/service-card.tsx` — Monitoring card with metric display and sparkline
- `src/lib/providers/` — Provider definitions (OpenRouter, Resend, Sentry)
- `src/lib/supabase/` — Supabase client (server + browser)
- `src/app/api/` — Next.js API routes (services CRUD, validation)

Path alias: `@/*` → `./src/*`

## CSS Theme

Dark-first design system. CSS variables are defined in `src/app/globals.css` using Tailwind v4's `@theme inline` block:
- Background: `zinc-950` (`#09090b`)
- Primary: `emerald-500` (`#10b981`)
- Card: `zinc-900` (`#18181b`)

Use Tailwind utilities like `bg-background`, `text-foreground`, `bg-card`, `text-primary` in components.

## TDD Workflow

Test framework: **Vitest** + `@testing-library/react`

```bash
npx vitest              # Watch mode (keep running during development)
npx vitest run          # Single run, all tests
npx vitest run src/path/to/file.test.ts  # Single file
npx vitest --coverage   # Coverage report
```

**Red-Green-Refactor** (required for all features and bug fixes):

1. **Red** — Write a failing test that describes the expected behavior
2. **Green** — Write the minimum implementation to make the test pass
3. **Refactor** — Clean up under green tests

Never write implementation code without a corresponding failing test first.

## Test Account

| Field    | Value                  |
|----------|------------------------|
| Email    | `dev@stackpulse.local` |
| Password | `Test1234!`            |

Seed file: `supabase/seed.sql`. Run `supabase db reset` to recreate the local database with this account.
