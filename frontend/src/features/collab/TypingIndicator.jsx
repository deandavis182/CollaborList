/**
 * TypingIndicator — shows who is currently typing in a list's comment thread.
 *
 * Props:
 *   listId : string | number  — the list to observe typing state for
 *
 * Reads typing from the Zustand store:
 *   { [listId]: { [userId]: email } }
 */

import { useStore } from '../../lib/store.js'

export function TypingIndicator({ listId }) {
  const typing = useStore((s) => s.typing)
  const entries = Object.values(typing[listId] ?? {})

  let content = null
  if (entries.length === 1) {
    content = `${entries[0]} is typing…`
  } else if (entries.length > 1) {
    content = 'Several people are typing…'
  }

  return (
    <p
      data-testid="typing-indicator"
      className="text-xs text-text-muted min-h-[1rem]"
    >
      {content}
    </p>
  )
}
