/**
 * PresenceBar — renders a stacked avatar row for currently-present users.
 *
 * Reads presence from the Zustand store:
 *   { [userId]: { userId, email, currentListId, lastSeen } }
 *
 * Renders nothing (empty container) when no users are present.
 */

import { useStore } from '../../lib/store.js'
import { Avatar } from '../../ui/Avatar.jsx'

export function PresenceBar() {
  const presence = useStore((s) => s.presence)
  const entries = Object.values(presence)

  return (
    <div data-testid="presence-bar" className="flex items-center -space-x-2">
      {entries.map((entry) => (
        <Avatar
          key={entry.userId}
          size="xs"
          name={entry.email}
          data-testid={`presence-${entry.userId}`}
        />
      ))}
    </div>
  )
}
