/**
 * ProjectSettings — settings panel for a project.
 *
 * Props:
 *   project     : { id, name, color, wedding_date, archived }
 *   workspaceId : string | number
 *   open        : boolean
 *   onClose     : function
 *
 * Features:
 *   - Rename project (name field)
 *   - Color picker (preset swatches)
 *   - Event / target date (wedding_date)
 *   - Archive toggle
 *   - Delete with two-click confirm
 *   - Toast on error
 */

import { useState, useEffect } from 'react'
import { Sheet } from '../../ui/Sheet.jsx'
import { Field } from '../../ui/Field.jsx'
import { Button } from '../../ui/Button.jsx'
import { Toast } from '../../ui/Toast.jsx'
import { useUpdateProject, useDeleteProject } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { getApiError } from '../../lib/apiError.js'

// ---------------------------------------------------------------------------
// Preset color swatches
// ---------------------------------------------------------------------------
const COLOR_PRESETS = [
  { label: 'Purple color', value: '#7C6FF7' },
  { label: 'Rose color',   value: '#C4788A' },
  { label: 'Teal color',   value: '#4A9E8C' },
  { label: 'Amber color',  value: '#E8A838' },
  { label: 'Slate color',  value: '#64748B' },
  { label: 'Coral color',  value: '#E56B5B' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProjectSettings({ project, workspaceId, open, onClose }) {
  const [name, setName]               = useState(project?.name ?? '')
  const [color, setColor]             = useState(project?.color ?? COLOR_PRESETS[0].value)
  const [weddingDate, setWeddingDate] = useState(project?.wedding_date ?? '')
  const [archived, setArchived]       = useState(project?.archived ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset local form state whenever the panel opens with a fresh project
  useEffect(() => {
    if (open && project) {
      setName(project.name ?? '')
      setColor(project.color ?? COLOR_PRESETS[0].value)
      setWeddingDate(project.wedding_date ?? '')
      setArchived(project.archived ?? false)
      setConfirmDelete(false)
    }
  }, [open, project])

  const { currentProjectId, setCurrentProject } = useStore()
  const updateProject = useUpdateProject(workspaceId)
  const deleteProject = useDeleteProject(workspaceId)

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------
  function handleSave() {
    updateProject.mutate(
      { id: project.id, name, color, wedding_date: weddingDate || null, archived },
      {
        onSuccess: () => {
          onClose?.()
        },
      }
    )
  }

  // ---------------------------------------------------------------------------
  // Color swatch handler — saves immediately
  // ---------------------------------------------------------------------------
  function handleColorSelect(hex) {
    setColor(hex)
    updateProject.mutate(
      { id: project.id, color: hex },
      // no onSuccess close — just persist; user still controls the panel
    )
  }

  // ---------------------------------------------------------------------------
  // Delete handlers
  // ---------------------------------------------------------------------------
  function handleDeleteClick() {
    setConfirmDelete(true)
  }

  function handleDeleteConfirm() {
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        if (currentProjectId === project.id) {
          setCurrentProject(null)
        }
        onClose?.()
      },
    })
  }

  function handleDeleteCancel() {
    setConfirmDelete(false)
  }

  // ---------------------------------------------------------------------------
  // Error state (from update mutation)
  // ---------------------------------------------------------------------------
  const errorMessage =
    updateProject.isError
      ? getApiError(updateProject.error)
      : null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Project Settings"
      variant="drawer"
    >
      <div className="flex flex-col gap-6">

        {/* Error toast */}
        {errorMessage && (
          <Toast
            message={errorMessage}
            variant="error"
            onDismiss={() => {}}
          />
        )}

        {/* Name */}
        <Field label="Name" htmlFor="settings-project-name">
          <input
            id="settings-project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        {/* Color swatches */}
        <Field label="Color">
          <div className="flex flex-wrap gap-2 mt-1">
            {COLOR_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                onClick={() => handleColorSelect(value)}
                className={[
                  'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  color === value ? 'border-text' : 'border-transparent',
                ].join(' ')}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </Field>

        {/* Target / event date */}
        <Field label="Target / event date" htmlFor="settings-wedding-date">
          <input
            id="settings-wedding-date"
            type="date"
            value={weddingDate}
            onChange={(e) => setWeddingDate(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        {/* Archive */}
        <div className="flex items-center gap-3">
          <input
            id="settings-archived"
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
            aria-label="Archive this project"
            className="h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <label
            htmlFor="settings-archived"
            className="text-sm font-medium text-text select-none"
          >
            Archive this project
          </label>
        </div>

        {/* Save + Cancel */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateProject.isPending}
          >
            {updateProject.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>

        {/* Danger zone — delete */}
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-text">Danger zone</p>

          {!confirmDelete ? (
            <Button type="button" variant="danger" onClick={handleDeleteClick}>
              Delete project
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-danger">
                This will permanently delete the project and all its lists.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDeleteCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleteProject.isPending}
                  onClick={handleDeleteConfirm}
                  aria-label="Confirm delete project"
                >
                  {deleteProject.isPending ? 'Deleting…' : 'Confirm delete'}
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Sheet>
  )
}
