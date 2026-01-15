// app/(mobile)/mobile/layout.tsx
import { MobileNav } from '@/components/mobile/mobile-nav'
import { OfflineIndicator } from '@/components/mobile/offline-indicator'
import { InstallPrompt } from '@/components/mobile/install-prompt'
import '@/app/globals.css'

export const metadata = {
  title: 'Bismillah Driver App',
  description: 'Mobile app for Bismillah Oil Agency drivers',
  manifest: '/manifest.json',
  themeColor: '#0ea5e9',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
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
  )
}
