/**
 * relativeTime — convert an ISO timestamp to a human-friendly relative string.
 *
 * Returns:
 *   "just now"  — less than 60 seconds ago
 *   "Xm ago"    — 1–59 minutes ago
 *   "Xh ago"    — 1–23 hours ago
 *   "Xd ago"    — 1+ days ago (up to ~29 days)
 *   locale date — fallback for anything else
 *
 * @param {string} iso — ISO 8601 date string
 * @returns {string}
 */
export function relativeTime(iso) {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return iso

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`

  return date.toLocaleDateString()
}
