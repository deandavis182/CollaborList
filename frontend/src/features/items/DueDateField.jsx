/**
 * DueDateField — date input for an item's due date.
 *
 * Props:
 *   value    : string | null  — ISO timestamp or null
 *   onChange : function       — called with 'YYYY-MM-DD' string or null (when cleared)
 *
 * The backend accepts a YYYY-MM-DD string as a timestamp.
 */

export function DueDateField({ value, onChange }) {
  // Convert ISO timestamp → YYYY-MM-DD for the native date input.
  // String slice avoids the UTC-shift bug that new Date().toISOString() introduces
  // in behind-UTC timezones when the value is already a YYYY-MM-DD string.
  const inputValue = value ? String(value).slice(0, 10) : ''

  function handleChange(e) {
    if (e.target.value === '') {
      onChange(null)
    } else {
      onChange(e.target.value)
    }
  }

  return (
    <input
      type="date"
      value={inputValue}
      onChange={handleChange}
      className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    />
  )
}
