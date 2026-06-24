import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyTasks } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { listColor, listTint } from '../../lib/listColor.js'
import { TaskResultRow } from './TaskResultRow.jsx'

function deriveLists(tasks) {
  const map = new Map()
  for (const t of tasks) {
    const cur = map.get(t.list_id) || { id: t.list_id, name: t.list_name, project: t.project_name, projectId: t.project_id, workspaceId: t.workspace_id, total: 0, done: 0 }
    cur.total += 1
    if (t.completed) cur.done += 1
    map.set(t.list_id, cur)
  }
  return [...map.values()]
}

export function filterTasks(tasks, q) {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return tasks.filter((t) =>
    (t.text || '').toLowerCase().includes(s) ||
    (t.list_name || '').toLowerCase().includes(s) ||
    (t.project_name || '').toLowerCase().includes(s) ||
    (t.assignee_email || '').toLowerCase().includes(s),
  )
}

export function ListsScreen() {
  const { data: tasks = [] } = useMyTasks()
  const navigate = useNavigate()
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const openItem = useStore((s) => s.openItem)

  const lists = useMemo(() => deriveLists(tasks), [tasks])
  const results = useMemo(() => filterTasks(tasks, searchQuery), [tasks, searchQuery])
  const searching = searchQuery.trim().length > 0

  return (
    <div data-testid="lists-screen" className="px-[18px] pt-[62px] pb-[116px] space-y-4 min-h-full bg-bg">
      <h1 className="text-[30px] font-bold font-display tracking-[-0.8px] text-text">Lists</h1>

      <div className="flex items-center gap-2 px-[14px] py-[11px] rounded-xl border border-border bg-surface shadow-card">
        <span aria-hidden="true" className="text-text-muted">⌕</span>
        <input
          data-testid="mobile-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all tasks, people, lists…"
          className="flex-1 bg-transparent outline-none text-[15px] text-text placeholder:text-text-muted"
        />
        {searching && (
          <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')} className="w-[22px] h-[22px] rounded-full bg-surface-2 text-text-muted">×</button>
        )}
      </div>

      {searching ? (
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2">{results.length} result{results.length === 1 ? '' : 's'}</div>
          {results.length === 0 ? (
            <p className="text-center text-text-muted py-10">No tasks match your search</p>
          ) : (
            results.map((t) => (
              <TaskResultRow key={t.id} task={t} showListContext onOpen={() => openItem(t.id, { listId: t.list_id, workspaceId: t.workspace_id })} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((l) => {
            const open = l.total - l.done
            const pct = l.total ? Math.round((l.done / l.total) * 100) : 0
            return (
              <button
                key={l.id}
                type="button"
                data-testid={`list-card-${l.id}`}
                onClick={() => navigate(`/w/${l.workspaceId}/p/${l.projectId}/l/${l.id}`)}
                className="w-full text-left rounded-2xl p-4 border border-border bg-surface shadow-card flex flex-col gap-[13px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-[11px] grid place-items-center shrink-0" style={{ background: listTint(l.id) }}>
                    <span className="w-[14px] h-[14px] rounded-md" style={{ background: listColor(l.id) }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-text truncate">{l.name}</span>
                    <span className="block text-[12.5px] text-text-muted truncate">{l.project}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[18px] font-bold font-display text-text leading-none">{open}</span>
                    <span className="block text-[11px] text-text-muted">open</span>
                  </span>
                </div>
                <span className="block h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: listColor(l.id) }} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
