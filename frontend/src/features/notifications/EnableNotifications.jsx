/**
 * EnableNotifications — button + status for push notification opt-in/out.
 *
 * States:
 *   push not supported  → "push-unsupported" muted line
 *   permission denied   → "push-denied" muted line
 *   permission granted  → "push-on" status + "Turn off" button
 *   default/else        → "enable-push-btn" button that subscribes
 *
 * InstallHint is always rendered above the button.
 */

import { useState } from 'react'
import { Button } from '../../ui/Button.jsx'
import { InstallHint } from './InstallHint.jsx'
import { useVapidKey } from '../../lib/api.js'
import {
  pushSupported,
  getPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/push.js'

export function EnableNotifications() {
  // Track permission state locally so we can flip without a page reload
  const [permission, setPermission] = useState(() => getPermission())
  const { data: vapidKey } = useVapidKey()

  if (!pushSupported()) {
    return (
      <p
        data-testid="push-unsupported"
        className="text-sm text-text-muted"
      >
        Notifications aren&rsquo;t supported on this browser.
      </p>
    )
  }

  if (permission === 'denied') {
    return (
      <p
        data-testid="push-denied"
        className="text-sm text-text-muted"
      >
        Notifications are blocked in your browser settings.
      </p>
    )
  }

  if (permission === 'granted') {
    return (
      <div data-testid="push-on" className="flex items-center gap-3">
        <span className="text-sm text-text">Notifications on</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await unsubscribeFromPush()
            setPermission(getPermission())
          }}
        >
          Turn off
        </Button>
      </div>
    )
  }

  // Default / prompt state
  return (
    <div className="flex flex-col gap-2">
      <InstallHint />
      <Button
        variant="primary"
        size="sm"
        data-testid="enable-push-btn"
        onClick={async () => {
          const result = await subscribeToPush(vapidKey)
          if (result) {
            setPermission('granted')
          }
        }}
      >
        Enable notifications
      </Button>
    </div>
  )
}
