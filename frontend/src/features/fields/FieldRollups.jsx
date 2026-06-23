/**
 * FieldRollups — read-only footer presenting roll-up summaries for a list's
 * custom fields.  PURE component — no hooks, no data fetching.
 *
 * Props:
 *   fieldDefs : array  — field definitions [{ id, key, type, label, config, position }]
 *   items     : array  — item objects with item.fields = { [key]: value }
 */

import { computeRollups } from './rollups.js'
import { Chip } from '../../ui/Chip.jsx'

export function FieldRollups({ fieldDefs = [], items = [] }) {
  const { numbers, budget, guests } = computeRollups(fieldDefs, items)

  if (numbers.length === 0 && !budget && !guests) return null

  // Unit for the cost def (used for budget display)
  const costDef  = fieldDefs.find((d) => d.key === 'cost')
  const costUnit = costDef?.config?.unit || ''

  return (
    <div
      data-testid="field-rollups"
      className="pt-3 mt-1 flex flex-wrap gap-3 items-center"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        Roll-ups
      </span>

      {/* Budget block */}
      {budget && (
        <div
          data-testid="rollup-budget"
          className="flex gap-2 items-center"
        >
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Budget:</span>
          <Chip color="neutral">
            Total <span data-testid="rollup-budget-total">{costUnit}{String(budget.total)}</span>
          </Chip>
          <Chip color="success">
            Paid <span data-testid="rollup-budget-paid">{costUnit}{String(budget.paid)}</span>
          </Chip>
          <Chip color="warning">
            Remaining <span data-testid="rollup-budget-remaining">{costUnit}{String(budget.remaining)}</span>
          </Chip>
        </div>
      )}

      {/* Guests block */}
      {guests && (
        <div
          data-testid="rollup-guests"
          className="flex gap-2 items-center"
        >
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Guests:</span>
          <Chip color="neutral">
            Invited <span data-testid="rollup-guests-invited">{String(guests.invited)}</span>
          </Chip>
          <Chip color="success">
            Confirmed <span data-testid="rollup-guests-confirmed">{String(guests.confirmed)}</span>
          </Chip>
        </div>
      )}

      {/* Generic number roll-ups */}
      {numbers.map((n) => (
        <Chip key={n.key} color="neutral" data-testid={`rollup-number-${n.key}`}>
          {n.label}: {n.unit}{String(n.sum)}
        </Chip>
      ))}
    </div>
  )
}
