/**
 * CreateProjectDialog — Sheet-based dialog for creating a new project.
 *
 * Props:
 *   open        : boolean
 *   onClose     : function
 *   workspaceId : string | number — the workspace to create the project in
 */

import { useState } from 'react'
import { Sheet } from '../../ui/Sheet.jsx'
import { Field } from '../../ui/Field.jsx'
import { Button } from '../../ui/Button.jsx'
import { useCreateProject } from '../../lib/api.js'

export function CreateProjectDialog({ open, onClose, workspaceId }) {
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')

  const { mutate, isPending, isError, error } = useCreateProject(workspaceId)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('Project name is required')
      return
    }
    setLocalError('')
    mutate({ name: trimmed }, {
      onSuccess: () => {
        setName('')
        onClose?.()
      },
    })
  }

  function handleClose() {
    setName('')
    setLocalError('')
    onClose?.()
  }

  const errorMessage = localError || (isError ? (error?.message ?? 'Something went wrong') : '')

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="New Project"
      variant="drawer"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Project Name"
          htmlFor="project-name"
          error={errorMessage}
        >
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Wedding"
            autoFocus
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
