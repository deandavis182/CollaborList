const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'lists', label: 'Lists' },
  { id: 'activity', label: 'Activity' },
  { id: 'me', label: 'Me' },
]

export function MobileTabBar({ activeTab, onSelect, onAdd, activityUnread = false }) {
  return (
    <nav
      data-testid="mobile-tab-bar"
      aria-label="Main navigation"
      className="fixed inset-x-3.5 bottom-[22px] h-[60px] rounded-[26px] border border-border bg-tabbar backdrop-blur-xl [backdrop-filter:blur(20px)_saturate(180%)] shadow-card flex items-center justify-around px-2 z-30"
    >
      {TABS.slice(0, 2).map((t) => (
        <TabButton key={t.id} tab={t} active={activeTab === t.id} onSelect={onSelect} />
      ))}

      <button
        type="button"
        data-testid="mtab-add"
        aria-label="New task"
        onClick={onAdd}
        className="w-[54px] h-[54px] -translate-y-0.5 rounded-2xl bg-brand-gradient text-white text-2xl leading-none font-semibold shadow-[0_8px_20px_rgba(124,111,247,.45)] flex items-center justify-center shrink-0"
      >
        +
      </button>

      {TABS.slice(2).map((t) => (
        <TabButton key={t.id} tab={t} active={activeTab === t.id} onSelect={onSelect} unread={t.id === 'activity' && activityUnread} />
      ))}
    </nav>
  )
}

function TabButton({ tab, active, onSelect, unread = false }) {
  return (
    <button
      type="button"
      data-testid={`mtab-${tab.id}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect?.(tab.id)}
      className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2"
    >
      <span
        aria-hidden="true"
        className={[
          'w-[9px] h-[9px] rounded-[2px] transition-colors',
          active ? 'bg-primary shadow-[0_0_8px_rgba(124,111,247,.7)]' : 'bg-text-muted/40',
        ].join(' ')}
      />
      <span className={['text-[10.5px] font-bold tracking-tight', active ? 'text-primary' : 'text-text-muted'].join(' ')}>
        {tab.label}
      </span>
      {unread && (
        <span data-testid="mtab-activity-unread" aria-hidden="true" className="absolute top-1 right-[28%] w-2 h-2 rounded-full bg-danger" />
      )}
    </button>
  )
}
