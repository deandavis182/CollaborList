/**
 * TagManager — manage workspace tags.
 *
 * Lists existing tags as Chips with remove capability.
 * Provides a form to create new tags (name + optional color).
 *
 * Props:
 *   workspaceId : string | number  — id of the workspace to manage tags for.
 *                 Falls back to currentWorkspaceId from store when omitted.
 */

import { useState } from 'react'
import { useTags, useCreateTag, useDeleteTag } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { getApiError } from '../../lib/apiError.js'
import { Chip } from '../../ui/Chip.jsx'
import { Button } from '../../ui/Button.jsx'
import { Field } from '../../ui/Field.jsx'

const PRESET_COLORS = [
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
 * Map an arbitrary hex color to one of the Chip color tokens.
 * Falls back to 'neutral'.
 */
function hexToChipColor(hex) {
  if (!hex) return 'neutral'
  const h = hex.toLowerCase()
  if (h === '#ef4444') return 'danger'
  if (h === '#22c55e') return 'success'
  if (h === '#eab308') return 'warning'
  if (h === '#3b82f6') return 'primary'
  if (h === '#8b5cf6') return 'accent'
  return 'neutral'
}

export function TagManager({ workspaceId: propWorkspaceId }) {
  const storeWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const workspaceId = propWorkspaceId ?? storeWorkspaceId

  // ── Tag data ──────────────────────────────────────────────────────────────
  const { data: tags = [], isLoading } = useTags(workspaceId)
  const { mutate: createTag, isPending: isCreating } = useCreateTag(workspaceId)
  const { mutate: deleteTag } = useDeleteTag(workspaceId)

  // ── Create-form state ─────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [formError, setFormError] = useState('')

  function handleCreate(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Tag name is required')
      return
    }
    setFormError('')
    createTag(
      { name: trimmed, ...(color ? { color } : {}) },
      {
        onSuccess: () => {
          setName('')
          setColor('')
        },
        onError: (err) => {
          setFormError(getApiError(err, 'Failed to create tag'))
        },
      }
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section aria-label="Tag manager" className="flex flex-col gap-6">
      {/* Existing tags */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Tags</h3>

        {isLoading ? (
          <p className="text-sm text-text-muted" role="status">
            Loading tags…
          </p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-text-muted">No tags yet. Create one below.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Workspace tags">
            {tags.map((tag) => (
              <div key={tag.id} role="listitem">
                <Chip
                  color={hexToChipColor(tag.color)}
                  onRemove={() => deleteTag(tag.id)}
                >
                  {tag.name}
                </Chip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">New tag</h3>

        <Field label="Name" htmlFor="tag-name" error={formError}>
          <input
            id="tag-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Urgent"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Color (optional)</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Color swatches">
            {PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Select color ${hex}`}
                aria-pressed={color === hex}
                onClick={() => setColor(color === hex ? '' : hex)}
                className="w-6 h-6 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-transform hover:scale-110"
                style={{
                  backgroundColor: hex,
                  borderColor: color === hex ? 'currentColor' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isCreating}>
            {isCreating ? 'Adding…' : 'Add tag'}
          </Button>
        </div>
      </form>
    </section>
  )
}
