import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — route protection is handled in each layout's Server Component
  // Guard against stale refresh tokens: getUser() can hang forever if the token is
  // invalid, so race it against a timeout. On failure, clear auth cookies.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 5000)),
    ])
  } catch {
    // Clear Supabase auth cookies to prevent infinite retry with a bad token
    const cookieNames = request.cookies.getAll().map((c) => c.name)
    for (const name of cookieNames) {
      if (name.startsWith('sb-')) {
        supabaseResponse.cookies.set(name, '', { maxAge: 0, path: '/' })
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
