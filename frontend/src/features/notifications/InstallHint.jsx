/**
 * InstallHint — renders platform-appropriate install guidance.
 *
 * iOS Safari (not installed): shows a text hint with testid "ios-install-hint".
 * Android/desktop (beforeinstallprompt available): shows an "Install app" button
 *   with testid "install-app-btn".
 * Already installed (standalone display-mode): renders nothing.
 *
 * All window/navigator accesses are guarded for jsdom safety.
 */

import { useState, useEffect } from 'react'
import { Button } from '../../ui/Button.jsx'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    // iOS Safari specific
    (typeof navigator !== 'undefined' && navigator.standalone === true)
  )
}

export function InstallHint() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    function handleBeforeInstallPrompt(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // Already installed — render nothing
  if (isStandalone()) return null

  // iOS Safari — show text hint
  if (isIOS()) {
    return (
      <p
        data-testid="ios-install-hint"
        className="text-sm text-text-muted"
      >
        On iPhone: tap the Share icon, then &lsquo;Add to Home Screen&rsquo; to install and get reminders.
      </p>
    )
  }

  // Android / desktop — show install button when the prompt is available
  if (deferredPrompt) {
    return (
      <Button
        variant="secondary"
        size="sm"
        data-testid="install-app-btn"
        onClick={() => {
          deferredPrompt.prompt()
          setDeferredPrompt(null)
        }}
      >
        Install app
      </Button>
    )
  }

  // Prompt not yet captured or not applicable — render nothing
  return null
}
