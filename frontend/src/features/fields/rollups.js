/**
 * rollups.js — pure roll-up math for structured field defs + items.
 *
 * Exported:
 *   computeRollups(fieldDefs, items) → { numbers, budget, guests }
 */

/**
 * Coerce a raw field value to a finite number, treating null/undefined/''/non-finite as 0.
 */
function coerceNum(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

/**
 * computeRollups — main export.
 *
 * @param {Array} fieldDefs — list of { id, key, type, label, config, position }
 * @param {Array} items     — list of { fields: { [key]: value }, ... }
 * @returns {{ numbers: Array, budget: object|null, guests: object|null }}
 */
export function computeRollups(fieldDefs, items) {
  const defs     = Array.isArray(fieldDefs) ? fieldDefs : []
  const allItems = Array.isArray(items)     ? items     : []

  // Index defs by key for quick lookup
  const defByKey = {}
  for (const def of defs) {
    defByKey[def.key] = def
  }

  // ── Preset detection ──────────────────────────────────────────────────────

  const hasBudget =
    defs.some((d) => d.key === 'cost'       && d.type === 'number') &&
    defs.some((d) => d.key === 'payment'    && d.type === 'status')

  const hasGuests =
    defs.some((d) => d.key === 'party_size' && d.type === 'number') &&
    defs.some((d) => d.key === 'rsvp'       && d.type === 'status')

  // Keys consumed by active preset blocks — not included in generic numbers
  const consumedKeys = new Set()
  if (hasBudget) consumedKeys.add('cost')
  if (hasGuests) consumedKeys.add('party_size')

  // ── Budget block ──────────────────────────────────────────────────────────

  let budget = null
  if (hasBudget) {
    let total     = 0
    let paid      = 0
    const costDef = defByKey['cost']
    const unit    = costDef?.config?.unit || ''

    for (const item of allItems) {
      const fields  = item.fields ?? {}
      const costVal = coerceNum(fields['cost'])
      total += costVal
      if (fields['payment'] === 'Paid') {
        paid += costVal
      }
    }

    budget = { total, paid, remaining: total - paid, unit }
  }

  // ── Guests block ──────────────────────────────────────────────────────────

  let guests = null
  if (hasGuests) {
    let invited   = 0
    let confirmed = 0

    for (const item of allItems) {
      const fields    = item.fields ?? {}
      const partyVal  = coerceNum(fields['party_size'])
      invited += partyVal
      if (fields['rsvp'] === 'Yes') {
        confirmed += partyVal
      }
    }

    guests = { invited, confirmed }
  }

  // ── Generic numbers (not consumed by a preset) ────────────────────────────

  const numberDefs = defs.filter((d) => d.type === 'number' && !consumedKeys.has(d.key))

  const numbers = numberDefs.map((def) => {
    let sum = 0
    for (const item of allItems) {
      const fields = item.fields ?? {}
      sum += coerceNum(fields[def.key])
    }
    return {
      key:   def.key,
      label: def.label || def.key,
      sum,
      unit:  def.config?.unit || '',
    }
  })

  return { numbers, budget, guests }
}
