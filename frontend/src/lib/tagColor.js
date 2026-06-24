/**
 * tagColor.js — shared tag-color helpers.
 *
 * Extracted from features/tags/TagManager.jsx so all features
 * (mobile workspace screen, tag manager, pickers, etc.) share one source of truth.
 */

export const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
]

/**
 * Map an arbitrary hex tag color to one of the Chip color tokens.
 * Falls back to 'neutral'.
 *
 * @param {string|null|undefined} hex
 * @returns {'neutral'|'primary'|'accent'|'success'|'warning'|'danger'}
 */
export function hexToChipColor(hex) {
  if (!hex) return 'neutral'
  const h = String(hex).toLowerCase()
  if (h === '#ef4444') return 'danger'
  if (h === '#22c55e') return 'success'
  if (h === '#eab308') return 'warning'
  if (h === '#3b82f6') return 'primary'
  if (h === '#8b5cf6') return 'accent'
  return 'neutral'
}
