/**
 * ItemFieldCells — compact read-only summary of an item's custom field values.
 * PURE component — no hooks, no data fetching.
 *
 * Props:
 *   item      : object  — the item (must have item.fields = { [key]: value })
 *   fieldDefs : array   — [{ id, key, type, label, config, position }]
 *   members   : array   — [{ user_id, email }] for resolving person fields
 */

import { Chip } from '../../ui/Chip.jsx'

/**
 * Format a single field value for inline display.
 * Returns null when the value is empty/unset.
 */
function formatFieldValue(def, rawValue, members) {
  // Skip empty values
  if (rawValue == null || rawValue === '') return null

  switch (def.type) {
    case 'number': {
      const unit = def.config?.unit || ''
      return `${unit}${rawValue}`
    }
    case 'date': {
      // No new Date — use slice to avoid UTC shift
      return String(rawValue).slice(0, 10)
    }
    case 'status':
    case 'text': {
      return String(rawValue)
    }
    case 'person': {
      const member = members.find((m) => String(m.user_id) === String(rawValue))
      return member ? member.email : String(rawValue)
    }
    default:
      return String(rawValue)
  }
}

export function ItemFieldCells({ item, fieldDefs = [], members = [] }) {
  const fields = item?.fields ?? {}

  // Only render defs that have a non-empty value
  const cells = fieldDefs
    .map((def) => {
      const formatted = formatFieldValue(def, fields[def.key], members)
      return formatted !== null ? { def, formatted } : null
    })
    .filter(Boolean)

  if (cells.length === 0) return null

  return (
    <span data-testid="item-field-cells" className="flex flex-wrap gap-1">
      {cells.map(({ def, formatted }) => (
        <Chip
          key={def.key}
          color="neutral"
          data-testid={`item-field-cell-${def.key}`}
        >
          {formatted}
        </Chip>
      ))}
    </span>
  )
}
