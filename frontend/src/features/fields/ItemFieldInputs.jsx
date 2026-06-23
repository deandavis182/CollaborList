/**
 * ItemFieldInputs — renders each custom field def as the appropriate typed
 * input control, bound to the item's current field value and persisting via
 * useSetItemField.
 *
 * Props:
 *   item        : object               — the item (must have id and fields?)
 *   listId      : string | number      — list the item belongs to
 *   workspaceId : string | number      — workspace for member resolution
 */

import { useRef, useState, useEffect } from 'react'
import { useFieldDefs, useSetItemField, useWorkspaceMembers } from '../../lib/api.js'
import { Field } from '../../ui/Field.jsx'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'

export function ItemFieldInputs({ item, listId, workspaceId }) {
  const { data: defs = [] } = useFieldDefs(listId)
  const setField = useSetItemField(listId)
  const { data: members = [] } = useWorkspaceMembers(workspaceId)

  if (!defs.length) return null

  return (
    <div data-testid="item-field-inputs" className="flex flex-col gap-4">
      {defs.map((def) => (
        <FieldControl
          key={def.key}
          def={def}
          item={item}
          members={members}
          setField={setField}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-def field control — each type has its own sub-component
// ---------------------------------------------------------------------------

function FieldControl({ def, item, members, setField }) {
  const currentValue = item?.fields?.[def.key] ?? null
  const label = def.label || def.key

  return (
    <Field label={label}>
      {def.type === 'number' && (
        <NumberFieldInput
          def={def}
          item={item}
          currentValue={currentValue}
          setField={setField}
        />
      )}
      {def.type === 'text' && (
        <TextFieldInput
          def={def}
          item={item}
          currentValue={currentValue}
          setField={setField}
        />
      )}
      {def.type === 'date' && (
        <DateFieldInput
          def={def}
          item={item}
          currentValue={currentValue}
          setField={setField}
        />
      )}
      {def.type === 'status' && (
        <StatusFieldInput
          def={def}
          item={item}
          currentValue={currentValue}
          setField={setField}
        />
      )}
      {def.type === 'person' && (
        <PersonFieldInput
          def={def}
          item={item}
          currentValue={currentValue}
          members={members}
          setField={setField}
        />
      )}
    </Field>
  )
}

// ---------------------------------------------------------------------------
// Number field — blur-to-commit (also fires on change for simpler test wiring)
// ---------------------------------------------------------------------------

function NumberFieldInput({ def, item, currentValue, setField }) {
  // Track local value to allow editing without committing on each keystroke.
  const [localValue, setLocalValue] = useState(
    currentValue != null ? String(currentValue) : ''
  )

  // Keep in sync when item changes
  useEffect(() => {
    setLocalValue(currentValue != null ? String(currentValue) : '')
  }, [item?.id, def.key, currentValue])

  function commit(raw) {
    if (raw === '') {
      setField.mutate({ itemId: item.id, key: def.key, type: 'number', value: null })
    } else {
      setField.mutate({ itemId: item.id, key: def.key, type: 'number', value: Number(raw) })
    }
  }

  return (
    <input
      type="number"
      data-testid={`item-field-${def.key}`}
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value)
        commit(e.target.value)
      }}
      onBlur={(e) => commit(e.target.value)}
      className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    />
  )
}

// ---------------------------------------------------------------------------
// Text field — debounced 400ms
// ---------------------------------------------------------------------------

function TextFieldInput({ def, item, currentValue, setField }) {
  const [localValue, setLocalValue] = useState(currentValue != null ? String(currentValue) : '')
  const debounceRef = useRef(null)

  // Keep in sync when item changes
  useEffect(() => {
    setLocalValue(currentValue != null ? String(currentValue) : '')
  }, [item?.id, def.key, currentValue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setLocalValue(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setField.mutate({
        itemId: item.id,
        key:    def.key,
        type:   'text',
        value:  val === '' ? null : String(val),
      })
    }, 400)
  }

  return (
    <input
      type="text"
      data-testid={`item-field-${def.key}`}
      value={localValue}
      onChange={handleChange}
      className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    />
  )
}

// ---------------------------------------------------------------------------
// Date field — YYYY-MM-DD slice (no UTC shift)
// ---------------------------------------------------------------------------

function DateFieldInput({ def, item, currentValue, setField }) {
  // Use String slice to avoid UTC-shift: "2026-07-15T00:00:00.000Z" → "2026-07-15"
  const inputValue = currentValue != null ? String(currentValue).slice(0, 10) : ''

  function handleChange(e) {
    const val = e.target.value
    setField.mutate({
      itemId: item.id,
      key:    def.key,
      type:   'date',
      value:  val === '' ? null : val,
    })
  }

  return (
    <input
      type="date"
      data-testid={`item-field-${def.key}`}
      value={inputValue}
      onChange={handleChange}
      className="w-full text-sm rounded-md border border-border bg-surface px-3 py-1.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    />
  )
}

// ---------------------------------------------------------------------------
// Status field — SegmentedControl over def.config.options
// ---------------------------------------------------------------------------

function StatusFieldInput({ def, item, currentValue, setField }) {
  const options = (def.config?.options ?? []).map((opt) => ({
    value: opt,
    label: opt,
  }))

  return (
    <SegmentedControl
      data-testid={`item-field-${def.key}`}
      options={options}
      value={currentValue != null ? String(currentValue) : ''}
      onChange={(val) => {
        setField.mutate({
          itemId: item.id,
          key:    def.key,
          type:   'status',
          value:  val || null,
        })
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Person field — select of workspace members
// ---------------------------------------------------------------------------

function PersonFieldInput({ def, item, currentValue, members, setField }) {
  const selectValue = currentValue != null ? String(currentValue) : ''

  function handleChange(e) {
    const val = e.target.value
    setField.mutate({
      itemId: item.id,
      key:    def.key,
      type:   'person',
      value:  val === '' ? null : Number(val),
    })
  }

  return (
    <select
      data-testid={`item-field-${def.key}`}
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
