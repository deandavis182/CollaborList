/**
 * AssigneePicker — select dropdown to assign an item to a workspace member.
 *
 * Props:
 *   value    : number | null  — current assignee_id (null = unassigned)
 *   members  : array          — [{ user_id, email }]
 *   onChange : function       — called with number (assignee_id) or null (unassigned)
 */

export function AssigneePicker({ value, members = [], onChange }) {
  // Coerce: null/undefined → '' for the select element
  const selectValue = value == null ? '' : String(value)

  function handleChange(e) {
    if (e.target.value === '') {
      onChange(null)
    } else {
      onChange(Number(e.target.value))
    }
  }

  return (
    <select
      value={selectValue}
      onChange={handleChange}
      className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.email}
        </option>
      ))}
    </select>
  )
}
