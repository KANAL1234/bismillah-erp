import type { Viewport } from 'next'
import { MobileNav } from '@/components/mobile/mobile-nav'
import { OfflineIndicator } from '@/components/mobile/offline-indicator'
import { InstallPrompt } from '@/components/mobile/install-prompt'
import { MobileAuthGuard } from '@/components/mobile/auth-guard'
import '@/app/globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
}

export const metadata = {
  title: 'Bismillah Driver App',
  description: 'Mobile app for Bismillah Oil Agency drivers',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bismillah Driver'
  }
}

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MobileAuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Offline/Online Status */}
        <OfflineIndicator />

        {/* Main Content with bottom padding for nav */}
        <main className="pb-16 pt-safe">
          {children}
        </main>

        {/* Bottom Navigation */}
        <MobileNav />

        {/* Install Prompt */}
        <InstallPrompt />
      </div>
    </MobileAuthGuard>
  )
}
