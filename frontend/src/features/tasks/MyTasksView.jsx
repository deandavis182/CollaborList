/**
 * MyTasksView — landing view showing all items assigned to the current user,
 * grouped by due date: Overdue, Today, Upcoming, No due date.
 *
 * Each task row deep-links to its list via /w/:workspaceId/p/:projectId/l/:listId.
 */

import { Link } from 'react-router-dom'
import { useMyTasks } from '../../lib/api.js'
import { Chip } from '../../ui/Chip.jsx'
import { groupTasksByDue } from './groupTasks.js'
import { formatDay } from '../../lib/dates.js'

// ---------------------------------------------------------------------------
// Status → Chip color map (mirrors ItemRow)
// ---------------------------------------------------------------------------

const STATUS_COLOR = {
  'To do': 'neutral',
  'Doing': 'primary',
  'Done': 'success',
  'Blocked': 'danger',
}

// ---------------------------------------------------------------------------
// taskHref — build a deep-link URL for a task row
// ---------------------------------------------------------------------------

function taskHref(task) {
  if (task.workspace_id && task.project_id && task.list_id) {
    return `/w/${task.workspace_id}/p/${task.project_id}/l/${task.list_id}`
  }
  return '#'
}

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

const ROW_CLASS = 'block px-3 py-2 rounded-md hover:bg-surface-2 transition-colors'

function TaskRowInner({ task }) {
  const statusColor = STATUS_COLOR[task.status] ?? 'neutral'

  // Context line: "project_name › list_name" or just "list_name"
  const context = task.project_name
    ? `${task.project_name} › ${task.list_name}`
    : task.list_name

  return (
    <div className="flex items-start justify-between gap-2">
      {/* Left: text + context */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-text truncate">{task.text}</span>
        {context && (
          <span className="text-xs text-text-muted truncate">{context}</span>
        )}
      </div>

      {/* Right: due date + status chip */}
      <div className="flex items-center gap-1.5 shrink-0">
        {task.due_date && (
          <span className="text-xs text-text-muted">
            {formatDay(task.due_date)}
          </span>
        )}
        {task.status && (
          <Chip color={statusColor}>{task.status}</Chip>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task }) {
  const href = taskHref(task)

  if (href === '#') {
    return (
      <a
        href="#"
        data-testid={`mytask-${String(task.id)}`}
        className={ROW_CLASS}
      >
        <TaskRowInner task={task} />
      </a>
    )
  }

  return (
    <Link
      to={href}
      data-testid={`mytask-${String(task.id)}`}
      className={ROW_CLASS}
    >
      <TaskRowInner task={task} />
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({ heading, tasks }) {
  if (!tasks || tasks.length === 0) return null

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 pb-1">
        {heading}
      </h2>
      <ul className="flex flex-col gap-0.5" role="list">
        {tasks.map((task) => (
          <li key={String(task.id)}>
            <TaskRow task={task} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// MyTasksView
// ---------------------------------------------------------------------------

export function MyTasksView() {
  const { data: tasks = [], isLoading } = useMyTasks()
  const { overdue, today, upcoming, noDate } = groupTasksByDue(tasks)

  const hasAny = overdue.length + today.length + upcoming.length + noDate.length > 0

  return (
    <div data-testid="my-tasks-view" className="p-8 max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">My Tasks</h1>

      {isLoading ? (
        <p data-testid="mytasks-loading" className="text-sm text-text-muted">
          Loading…
        </p>
      ) : !hasAny ? (
        <p data-testid="mytasks-empty" className="text-sm text-text-muted">
          No tasks assigned to you
        </p>
      ) : (
        <>
          <Section heading="Overdue" tasks={overdue} />
          <Section heading="Today" tasks={today} />
          <Section heading="Upcoming" tasks={upcoming} />
          <Section heading="No due date" tasks={noDate} />
        </>
      )}
    </div>
  )
}
