/**
 * ProjectListTree — renders the lists of the currently-active project as a
 * third level in the sidebar hierarchy (Workspace ▸ Project ▸ Lists).
 *
 * Shown only when currentProjectId is set in the store.  Each list links to
 *   /w/:workspaceId/p/:projectId/l/:listId
 * and is highlighted when that URL is active.
 *
 * Also provides an inline "+ New list" input so users can create a list
 * directly from the tree without navigating away.
 *
 * Props: none (reads currentWorkspaceId + currentProjectId from store).
 */

import { useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProjectLists, useCreateList } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'

export function ProjectListTree() {
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const currentProjectId = useStore((s) => s.currentProjectId)

  // Active list from the current URL — may be undefined outside list routes.
  const { listId: activeListId } = useParams()

  const { data: lists = [], isLoading } = useProjectLists(currentProjectId)
  const createList = useCreateList(currentProjectId)

  // Inline new-list state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef(null)

  if (!currentProjectId) return null

  function startCreating() {
    setCreating(true)
    setNewName('')
    // Focus the input on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitCreate() {
    const name = newName.trim()
    if (name) {
      createList.mutate({ name })
    }
    setCreating(false)
    setNewName('')
  }

  function cancelCreate() {
    setCreating(false)
    setNewName('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitCreate()
    if (e.key === 'Escape') cancelCreate()
  }

  return (
    <div className="mt-1" data-testid="project-list-tree">
      {isLoading ? (
        <p className="pl-10 pr-3 py-1 text-xs text-text-muted">Loading…</p>
      ) : lists.length === 0 && !creating ? (
        <p
          className="pl-10 pr-3 py-1 text-xs text-text-muted italic"
          data-testid="no-lists-hint"
        >
          No lists yet
        </p>
      ) : (
        <ul role="list" className="space-y-0.5">
          {lists.map((list) => {
            const isActive = String(list.id) === String(activeListId)
            return (
              <li key={list.id}>
                <Link
                  to={`/w/${currentWorkspaceId}/p/${currentProjectId}/l/${list.id}`}
                  data-testid={`sidebar-list-${list.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    // Level-3 indent: 40px left padding (workspace=0, project=pl-6, list=pl-10)
                    'flex items-center gap-1.5 w-full pl-10 pr-3 py-1 rounded-md text-xs transition-colors',
                    isActive
                      ? 'bg-surface-2 text-text font-medium'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  ].join(' ')}
                >
                  {/* List-level glyph — a simple bullet to distinguish from project ▸ */}
                  <span aria-hidden="true" className="shrink-0 opacity-60">–</span>
                  <span className="truncate">{list.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Inline new-list creator */}
      {creating ? (
        <div className="flex items-center gap-1 pl-10 pr-2 py-1 mt-0.5">
          <input
            ref={inputRef}
            data-testid="sidebar-new-list-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitCreate}
            placeholder="List name…"
            className="flex-1 min-w-0 text-xs bg-surface-2 border border-border rounded-sm px-2 py-0.5 text-text outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            data-testid="sidebar-new-list-button"
            onClick={commitCreate}
            className="text-xs text-primary hover:text-text transition-colors shrink-0"
            aria-label="Confirm new list"
          >
            ✓
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="sidebar-new-list-button"
          onClick={startCreating}
          className="flex items-center gap-1 pl-10 pr-3 py-1 text-xs text-text-muted hover:text-text transition-colors w-full text-left mt-0.5"
          aria-label="New list"
        >
          <span aria-hidden="true">+</span>
          New list
        </button>
      )}
    </div>
  )
}
