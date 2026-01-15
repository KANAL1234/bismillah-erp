// components/mobile/install-prompt.tsx
'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if user dismissed before
    const dismissed = localStorage.getItem('install-prompt-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const oneWeek = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - dismissedTime < oneWeek) {
        return // Don't show for a week after dismissal
      }
    }

    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return

    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('User accepted install')
      setInstallPrompt(null)
      setShowPrompt(false)
      setIsInstalled(true)
    } else {
      console.log('User dismissed install')
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('install-prompt-dismissed', Date.now().toString())
  }

  if (isInstalled || !showPrompt) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl z-50 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-md mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-5 h-5" />
              <p className="font-semibold text-lg">Install Bismillah App</p>
            </div>
            <p className="text-sm text-blue-100">
              Install on your home screen for quick access and offline use
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleInstall}
            className="flex-1 bg-white text-blue-600 hover:bg-blue-50 font-semibold"
            size="lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Install App
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            className="text-white hover:bg-white/10"
            size="lg"
          >
            Not Now
          </Button>
        </div>
      </div>
    </div>
  )
}

// iOS Safari install instructions
export function IOSInstallInstructions() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
    
    if (isIOS && !isInStandaloneMode) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4 z-50">
      <div className="max-w-md mx-auto">
        <p className="font-semibold mb-2">Install App on iOS</p>
        <ol className="text-sm space-y-1 text-blue-100">
          <li>1. Tap the Share button (bottom of screen)</li>
          <li>2. Select "Add to Home Screen"</li>
          <li>3. Tap "Add"</li>
        </ol>
        <button
          onClick={() => setShow(false)}
          className="mt-3 text-sm underline"
        >
          Got it, dismiss
        </button>
      </div>
    </div>
  )
}
