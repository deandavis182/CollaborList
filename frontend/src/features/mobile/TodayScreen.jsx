import { useMyTasks } from '../../lib/api.js'
import { groupTasksByDue, isCompletedToday } from '../tasks/groupTasks.js'
import { getUser } from '../../lib/auth.js'
import { useStore } from '../../lib/store.js'
import { FocusCard } from './FocusCard.jsx'
import { TaskCard } from './SwipeableTaskCard.jsx'
import { Avatar } from '../../ui/Avatar.jsx'

const SECTIONS = [
  { key: 'overdue', label: 'Overdue', dot: 'bg-danger' },
  { key: 'today', label: 'Today', dot: 'bg-warning' },
  { key: 'upcoming', label: 'Upcoming', dot: 'bg-primary' },
  { key: 'noDate', label: 'Someday', dot: 'bg-text-muted' },
]

function greeting(h = new Date().getHours()) {
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function dateLabel(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', ' ·').toUpperCase()
}

function AvatarInline({ name }) { return <Avatar name={name} size="md" /> }

export function TodayScreen() {
  const { data: tasks = [] } = useMyTasks()
  const openItem = useStore((s) => s.openItem)
  const user = getUser()
  const groups = groupTasksByDue(tasks)

  const openOverdue = groups.overdue.length
  const openToday = groups.today.filter((t) => !t.completed).length
  const completedToday = tasks.filter((t) => isCompletedToday(t)).length
  const denom = openOverdue + openToday + completedToday
  const percent = denom ? Math.round((completedToday / denom) * 100) : 100
  const needed = openOverdue + openToday
  const headline = needed ? `${needed} task${needed === 1 ? '' : 's'} need you today` : 'All clear for today'
  const subline = `${openOverdue} overdue · ${openToday} due today`
  const name = (user?.email || '').split('@')[0]

  return (
    <div data-testid="today-screen" className="px-[18px] pt-[62px] pb-[116px] space-y-[22px] min-h-full bg-bg">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold text-text-muted">{dateLabel()}</div>
          <h1 className="text-[30px] font-bold font-display tracking-[-0.8px] text-text leading-tight">{greeting()}, {name}</h1>
        </div>
        <a href="/me" aria-label="Profile" className="shrink-0 mt-1">
          <span className="block w-[42px] h-[42px]"><AvatarInline name={name} /></span>
        </a>
      </div>

      <FocusCard percent={percent} headline={headline} subline={subline} />

      {SECTIONS.map(({ key, label, dot }) => {
        const list = groups[key]
        if (!list.length) return null
        return (
          <section key={key} className="space-y-[9px]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
              <span className="text-[12px] font-bold tracking-[0.6px] uppercase text-text-muted">{label}</span>
              <span className="text-[12px] font-bold text-text-muted">{list.length}</span>
            </div>
            {list.map((task) => (
              <TaskCard key={task.id} task={task} onOpen={() => openItem(task.id, { listId: task.list_id, workspaceId: task.workspace_id })} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
