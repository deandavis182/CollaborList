import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, logout } from '../../lib/auth.js'
import { useMyTasks } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { NotificationPrefs } from '../notifications/NotificationPrefs.jsx'
import { isCompletedToday } from '../tasks/groupTasks.js'

const THEME_OPTIONS = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]

export function MeScreen() {
  const navigate = useNavigate()
  const user = getUser()
  const { data: tasks = [] } = useMyTasks()
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const [notifOpen, setNotifOpen] = useState(false)

  const open = tasks.filter((t) => !t.completed).length
  const doneToday = tasks.filter((t) => isCompletedToday(t)).length
  const name = (user?.email || '').split('@')[0]

  return (
    <div data-testid="me-screen" className="px-[18px] pt-[62px] pb-[116px] space-y-5 min-h-full bg-bg">
      <div className="flex flex-col items-center gap-2">
        <span className="w-[78px] h-[78px]"><Avatar name={name} size="lg" /></span>
        <h1 className="text-[21px] font-bold font-display text-text">{name}</h1>
        <p className="text-[13px] text-text-muted">{user?.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile value={open} label="open tasks" tone="text-primary" />
        <StatTile value={doneToday} label="done today" tone="text-success" />
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-card p-4 space-y-3">
        <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted">Appearance</div>
        <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <Row label="Notifications" onClick={() => setNotifOpen(true)} />
        <Row label="Live sync" />
        <Row label="Workspace" onClick={() => currentWorkspaceId && navigate(`/w/${currentWorkspaceId}`)} />
        <Row label="Members" onClick={() => currentWorkspaceId && navigate(`/w/${currentWorkspaceId}`)} last />
      </section>

      <button type="button" onClick={() => { logout(); window.location.assign('/login') }} className="w-full py-3 rounded-2xl bg-danger text-white font-semibold">Log out</button>

      <NotificationPrefs open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}

function StatTile({ value, label, tone }) {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card p-4 text-center">
      <div className={`text-[28px] font-bold font-display ${tone}`}>{value}</div>
      <div className="text-[12px] text-text-muted">{label}</div>
    </div>
  )
}

function Row({ label, onClick, last = false }) {
  return (
    <button type="button" onClick={onClick} className={['w-full flex items-center justify-between px-4 py-3.5 text-left text-[15px] text-text', last ? '' : 'border-b border-border'].join(' ')}>
      <span>{label}</span>
      <span aria-hidden="true" className="text-text-muted">›</span>
    </button>
  )
}
