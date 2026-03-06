import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stackpulse.dev'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'StackPulse — API Monitoring Dashboard for SaaS Dependencies',
    template: '%s | StackPulse',
  },
  description:
    'Monitor API rate limits, credit balances, error counts, and deployment status across GitHub, Stripe, OpenAI, Vercel, and 7 more providers. Free API monitoring with instant alerts.',
  keywords: [
    'API monitoring',
    'SaaS monitoring',
    'API rate limit alerts',
    'API health dashboard',
    'multi-provider monitoring',
    'SaaS dependency monitoring',
    'API credit balance alerts',
    'developer monitoring tools',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'StackPulse',
    title: 'StackPulse — API Monitoring Dashboard for SaaS Dependencies',
    description:
      'Monitor rate limits, credit balances, and deployment status across GitHub, Stripe, OpenAI, Vercel, and more. Free to start, alerts in under 30 seconds.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StackPulse — API Monitoring Dashboard',
    description:
      'One dashboard for all your SaaS dependencies. Monitor API rate limits, credit balances, and more with instant alerts.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
