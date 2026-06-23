/**
 * ProjectView — the main-area view rendered at /w/:workspaceId/p/:projectId.
 *
 * Reads :projectId from URL params, fetches lists via useProjectLists, and
 * renders them as clickable Cards that navigate to the list route. Also
 * exposes controls to create, rename, and delete lists within the project.
 */

import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  useProjectLists,
  useCreateList,
  useRenameList,
  useDeleteList,
  useProjectItems,
  useProjects,
  useWorkspaceMembers,
} from '../../lib/api.js'
import { Card } from '../../ui/Card.jsx'
import { Button } from '../../ui/Button.jsx'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { ViewContainer } from '../views/ViewContainer.jsx'
import { useStore } from '../../lib/store.js'

// ---------------------------------------------------------------------------
// RenameInput — inline rename control for a single list card
// ---------------------------------------------------------------------------

function RenameInput({ list, onCommit, onCancel }) {
  const [value, setValue] = useState(list.name)
  const inputRef = useRef(null)

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (trimmed && trimmed !== list.name) {
        onCommit(trimmed)
      } else {
        onCancel()
      }
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  function handleBlur() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== list.name) {
      onCommit(trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      className="w-full text-base font-medium text-text bg-surface border border-primary rounded px-1 focus:outline-none focus:ring-1 focus:ring-primary"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      data-testid={`rename-input-${list.id}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// ListCard — a single list card with rename + delete controls
// ---------------------------------------------------------------------------

function ListCard({ list, workspaceId, projectId, renameList, deleteList }) {
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDeleteClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (confirmDelete) {
      deleteList.mutate(list.id)
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
    }
  }

  function handleRenameClick(e) {
    e.preventDefault()
    e.stopPropagation()
    setRenaming(true)
    setConfirmDelete(false)
  }

  function handleRenameCommit(newName) {
    renameList.mutate({ id: list.id, name: newName })
    setRenaming(false)
  }

  function handleRenameCancel() {
    setRenaming(false)
  }

  return (
    <li key={list.id}>
      <div className="relative">
        {renaming ? (
          /* FIX 2: RenameInput is mutually exclusive with the Link — never nested inside <a> */
          <Card className="p-4" data-testid={`list-card-${list.id}`}>
            <RenameInput
              list={list}
              onCommit={handleRenameCommit}
              onCancel={handleRenameCancel}
            />
            {list.item_count !== undefined && (
              <p className="mt-1 text-sm text-text-muted">
                {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
              </p>
            )}
          </Card>
        ) : (
          <Link to={`/w/${workspaceId}/p/${projectId}/l/${list.id}`}>
            <Card className="p-4" data-testid={`list-card-${list.id}`}>
              <h2 className="text-base font-medium text-text truncate">{list.name}</h2>
              {list.item_count !== undefined && (
                <p className="mt-1 text-sm text-text-muted">
                  {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                </p>
              )}
            </Card>
          </Link>
        )}

        {/* FIX 1: Controls are always visible (no opacity/hover hiding) so touch users can access them.
            Small ghost buttons in muted text keep them visually unobtrusive.
            focus-visible ring ensures keyboard discoverability. */}
        <div
          className="absolute top-2 right-2 flex gap-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRenameClick}
            data-testid={`rename-list-${list.id}`}
            aria-label={`Rename ${list.name}`}
            className="text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Rename
          </Button>
          <Button
            variant={confirmDelete ? 'danger' : 'ghost'}
            size="sm"
            onClick={handleDeleteClick}
            data-testid={`delete-list-${list.id}`}
            aria-label={confirmDelete ? `Confirm delete ${list.name}` : `Delete ${list.name}`}
            className={confirmDelete ? undefined : 'text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'}
          >
            {confirmDelete ? 'Confirm' : 'Delete'}
          </Button>
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// NewListForm — inline create control
// ---------------------------------------------------------------------------

function NewListForm({ onCreate }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        className="flex-1 text-sm text-text bg-surface border border-border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="List name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="new-list-input"
      />
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={!name.trim()}
        data-testid="new-list-button"
      >
        + New list
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// MODE_OPTIONS — for the Lists | All items toggle
// ---------------------------------------------------------------------------

const MODE_OPTIONS = [
  { value: 'lists',   label: 'Lists'     },
  { value: 'rollup',  label: 'All items' },
]

// ---------------------------------------------------------------------------
// ProjectView
// ---------------------------------------------------------------------------

export function ProjectView() {
  const { workspaceId, projectId } = useParams()
  const navigate = useNavigate()
  const openDetail = useStore((s) => s.openDetail)

  // Mode toggle — 'lists' (default) | 'rollup'
  const [mode, setMode] = useState('lists')

  // Lists-mode data
  const { data: lists = [], isLoading } = useProjectLists(projectId)
  const createList = useCreateList(projectId)
  const renameList = useRenameList(projectId)
  const deleteList = useDeleteList(projectId)

  // Roll-up data (always call hooks unconditionally)
  const { data: projectItems = [] } = useProjectItems(projectId)
  const { data: allProjects = [] }  = useProjects(workspaceId)
  const { data: members = [] }      = useWorkspaceMembers(workspaceId)

  const project     = allProjects.find((p) => String(p.id) === String(projectId))
  const weddingDate = project?.wedding_date ? new Date(project.wedding_date) : undefined

  function handleCreate(name) {
    createList.mutate({ name })
  }

  function handleRollupOpenItem(item) {
    openDetail(item.id)
    navigate(`/w/${workspaceId}/p/${projectId}/l/${item.list_id}`)
  }

  return (
    <div data-testid="project-view" className="p-8 max-w-3xl">
      <p data-testid="workspace-id-display" className="sr-only">Workspace: {workspaceId}</p>
      <p data-testid="project-id-display" className="sr-only">Project: {projectId}</p>

      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text">Project Lists</h1>
        <SegmentedControl
          data-testid="project-mode"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'lists' && (
        <>
          <div className="mb-6">
            <NewListForm onCreate={handleCreate} />
          </div>

          {isLoading ? (
            <p data-testid="project-view-loading" className="text-sm text-text-muted">
              Loading lists…
            </p>
          ) : lists.length === 0 ? (
            <div data-testid="project-view-empty" className="text-sm text-text-muted">
              <p>No lists yet. Create your first list to start adding tasks.</p>
            </div>
          ) : (
            <ul
              role="list"
              data-testid="project-lists"
              className="grid gap-4 sm:grid-cols-2"
            >
              {lists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  renameList={renameList}
                  deleteList={deleteList}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {mode === 'rollup' && (
        <ViewContainer
          items={projectItems}
          workspaceId={workspaceId}
          projectId={projectId}
          scopeKey={`project:${projectId}`}
          members={members}
          weddingDate={weddingDate}
          showAddItem={false}
          onOpenItem={handleRollupOpenItem}
        />
      )}
    </div>
  )
}
