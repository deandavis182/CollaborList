/**
 * RecurrencePicker — select + interval input for item recurrence.
 *
 * Props:
 *   item : object — the item data (must have id, list_id, recur_unit, recur_interval)
 */

import { useUpdateItem } from '../../lib/api.js'

const UNIT_OPTIONS = [
  { label: 'None',    value: null },
  { label: 'Daily',   value: 'day' },
  { label: 'Weekly',  value: 'week' },
  { label: 'Monthly', value: 'month' },
  { label: 'Yearly',  value: 'year' },
]

export function RecurrencePicker({ item }) {
  const updateItem = useUpdateItem(item.list_id)

  const currentUnit = item.recur_unit ?? null
  const currentInterval = item.recur_interval ?? 1

  function handleUnitChange(e) {
    const raw = e.target.value
    const unit = raw === '' ? null : raw

    if (unit === null) {
      updateItem.mutate({ id: item.id, recur_unit: null, recur_interval: null })
    } else {
      updateItem.mutate({ id: item.id, recur_unit: unit, recur_interval: currentInterval })
    }
  }

  function handleIntervalChange(e) {
    const interval = parseInt(e.target.value, 10)
    if (!Number.isFinite(interval) || interval < 1) return
    updateItem.mutate({ id: item.id, recur_unit: currentUnit, recur_interval: interval })
  }

  return (
    <div data-testid="recurrence-picker" className="flex items-center gap-2">
      <select
        data-testid="recurrence-unit"
        value={currentUnit ?? ''}
        onChange={handleUnitChange}
        className="text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {UNIT_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>

      {currentUnit !== null && (
        <input
          data-testid="recurrence-interval"
          type="number"
          min={1}
          value={currentInterval}
          onChange={handleIntervalChange}
          className="w-20 text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}
    </div>
  )
}
