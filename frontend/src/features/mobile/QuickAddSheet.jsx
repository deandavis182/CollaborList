import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store.js'
import { useMyTasks, useCreateItem } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'
import { Sheet } from '../../ui/Sheet.jsx'
import { listColor } from '../../lib/listColor.js'

const WHEN = [
  { key: 'today', label: 'Today', offset: 0 },
  { key: 'tomorrow', label: 'Tomorrow', offset: 1 },
  { key: 'week', label: 'This week', offset: 3 },
  { key: 'someday', label: 'Someday', offset: null },
]

function dueFromOffset(offset) {
  if (offset == null) return null
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function distinctLists(tasks) {
  const map = new Map()
  for (const t of tasks) if (!map.has(t.list_id)) map.set(t.list_id, { id: t.list_id, name: t.list_name })
  return [...map.values()]
}

export function QuickAddSheet() {
  const open = useStore((s) => s.quickAddOpen)
  const setOpen = useStore((s) => s.setQuickAddOpen)
  const showToast = useStore((s) => s.showToast)
  const { data: tasks = [] } = useMyTasks()
  const lists = useMemo(() => distinctLists(tasks), [tasks])
  const [text, setText] = useState('')
  const [when, setWhen] = useState('today')
  const [listId, setListId] = useState(null)
  const user = getUser()
  const effectiveListId = listId ?? lists[0]?.id
  const { mutate: createItem } = useCreateItem(effectiveListId)

  if (!open) return null

  function submit() {
    if (!text.trim() || !effectiveListId) return
    const offset = WHEN.find((w) => w.key === when)?.offset ?? null
    createItem({ text: text.trim(), status: 'To do', assignee_id: user?.id ?? null, due_date: dueFromOffset(offset) })
    showToast('Task added')
    setText(''); setOpen(false)
  }

  return (
    <Sheet variant="bottom" open onClose={() => setOpen(false)} title="New task">
      <div className="px-5 pb-8 space-y-5">
        <input
          data-testid="quickadd-input"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="What needs doing?"
          className="w-full bg-transparent outline-none text-[17px] font-semibold text-text placeholder:text-text-muted"
        />
        <ChipRow label="When">
          {WHEN.map((w) => (
            <ChipToggle key={w.key} active={when === w.key} onClick={() => setWhen(w.key)}>{w.label}</ChipToggle>
          ))}
        </ChipRow>
        <ChipRow label="List">
          {lists.map((l) => (
            <ChipToggle key={l.id} active={effectiveListId === l.id} onClick={() => setListId(l.id)}>
              <span className="w-2 h-2 rounded-full" style={{ background: listColor(l.id) }} /> {l.name}
            </ChipToggle>
          ))}
        </ChipRow>
        <button type="button" data-testid="quickadd-submit" onClick={submit} className="w-full py-3 rounded-2xl bg-brand-gradient text-white font-semibold shadow-card">Add task</button>
      </div>
    </Sheet>
  )
}

function ChipRow({ label, children }) {
  return (
    <div>
      <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ChipToggle({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border', active ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-2 text-text-muted border-border'].join(' ')}>
      {children}
    </button>
  )
}
