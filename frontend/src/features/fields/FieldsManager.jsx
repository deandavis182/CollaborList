/**
 * FieldsManager — Sheet drawer for managing field definitions on a list.
 *
 * Props:
 *   listId  : string | number  — the list whose fields are managed
 *   open    : boolean
 *   onClose : function
 */

import { useState } from 'react'
import { Sheet } from '../../ui/Sheet.jsx'
import { Button } from '../../ui/Button.jsx'
import { Field } from '../../ui/Field.jsx'
import { Chip } from '../../ui/Chip.jsx'
import {
  useFieldDefs,
  useCreateFieldDef,
  useDeleteFieldDef,
  useApplyFieldPreset,
} from '../../lib/api.js'

const FIELD_TYPES = ['number', 'text', 'date', 'status', 'person']

/** Derive a key suggestion from a label string. */
function labelToKey(label) {
  return label.toLowerCase().replace(/\s+/g, '_')
}

/** Map field type to a Chip color. */
function typeColor(type) {
  switch (type) {
    case 'number':  return 'primary'
    case 'text':    return 'neutral'
    case 'date':    return 'accent'
    case 'status':  return 'warning'
    case 'person':  return 'success'
    default:        return 'neutral'
  }
}

export function FieldsManager({ listId, open, onClose }) {
  const { data: defs = [] } = useFieldDefs(String(listId))

  const deleteDef  = useDeleteFieldDef(String(listId))
  const createDef  = useCreateFieldDef(String(listId))
  const applyPreset = useApplyFieldPreset(String(listId))

  // ── Add-field form state ──────────────────────────────────────────────────
  const [label,   setLabel]   = useState('')
  const [key,     setKey]     = useState('')
  const [type,    setType]    = useState('number')
  const [options, setOptions] = useState('')
  // Track whether the user has manually edited the key
  const [keyTouched, setKeyTouched] = useState(false)

  function handleLabelChange(e) {
    const val = e.target.value
    setLabel(val)
    if (!keyTouched) {
      setKey(labelToKey(val))
    }
  }

  function handleKeyChange(e) {
    setKey(e.target.value)
    setKeyTouched(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const trimmedKey   = key.trim()
    const trimmedLabel = label.trim()
    if (!trimmedKey || !trimmedLabel) return

    const config =
      type === 'status'
        ? { options: options.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}

    createDef.mutate(
      { key: trimmedKey, type, label: trimmedLabel, config, position: defs.length },
      {
        onSuccess: () => {
          setLabel('')
          setKey('')
          setType('number')
          setOptions('')
          setKeyTouched(false)
        },
      }
    )
  }

  return (
    <Sheet variant="drawer" open={open} onClose={onClose} title="Fields">
      <div data-testid="fields-manager" className="flex flex-col gap-6">

        {/* ── Current field defs ──────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Current fields
          </h3>

          {defs.length === 0 ? (
            <p className="text-sm text-text-muted">No fields yet</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {defs.map((def) => (
                <li
                  key={String(def.id)}
                  data-testid={`field-def-${def.id}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2"
                >
                  <span className="flex-1 text-sm font-medium text-text">
                    {def.label || def.key}
                  </span>
                  <Chip color={typeColor(def.type)}>{def.type}</Chip>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`delete-field-def-${def.id}`}
                    aria-label={`Delete field ${def.label || def.key}`}
                    onClick={() => deleteDef.mutate(def.id)}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Add a field ─────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Add a field
          </h3>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Field label="Label" htmlFor="fm-field-label">
              <input
                id="fm-field-label"
                data-testid="field-label"
                type="text"
                value={label}
                onChange={handleLabelChange}
                placeholder="e.g. Budget"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>

            <Field label="Key" htmlFor="fm-field-key">
              <input
                id="fm-field-key"
                data-testid="field-key"
                type="text"
                value={key}
                onChange={handleKeyChange}
                placeholder="e.g. budget"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>

            <Field label="Type" htmlFor="fm-field-type">
              <select
                id="fm-field-type"
                data-testid="field-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            {type === 'status' && (
              <Field label="Options (comma-separated)" htmlFor="fm-field-options">
                <input
                  id="fm-field-options"
                  data-testid="field-options"
                  type="text"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="e.g. Open, In Progress, Done"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
            )}

            <Button
              type="submit"
              variant="primary"
              size="sm"
              data-testid="add-field-def-button"
              disabled={createDef.isPending}
            >
              {createDef.isPending ? 'Adding…' : 'Add field'}
            </Button>
          </form>
        </section>

        {/* ── Presets ─────────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-1 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Presets
          </h3>
          <p className="mb-3 text-xs text-text-muted">
            Presets add a standard set of fields for common use cases.
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              data-testid="preset-budget"
              disabled={applyPreset.isPending}
              onClick={() => applyPreset.mutate('budget')}
            >
              Budget tracker
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="preset-guests"
              disabled={applyPreset.isPending}
              onClick={() => applyPreset.mutate('guests')}
            >
              Guest list
            </Button>
          </div>
        </section>
      </div>
    </Sheet>
  )
}
