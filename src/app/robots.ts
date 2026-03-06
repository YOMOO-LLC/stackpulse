import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stackpulse.dev'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/login', '/dashboard/', '/connect/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
