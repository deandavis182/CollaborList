/**
 * BottomTabBar — mobile bottom navigation.
 *
 * Props:
 *   activeTab      : 'home' | 'search' | 'add' | 'activity' | 'me'
 *   onSelect       : (tab: string) => void
 *   activityUnread : boolean — when true, renders a small dot on the activity tab
 */

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'search', label: 'Search' },
  { id: 'add', label: '+' },
  { id: 'activity', label: 'Activity' },
  { id: 'me', label: 'Me' },
]

export function BottomTabBar({ activeTab, onSelect, activityUnread = false }) {
  return (
    <nav
      data-testid="bottom-tab-bar"
      className="flex items-stretch justify-around bg-surface border-t border-border"
      aria-label="Main navigation"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`tab-${tab.id}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect?.(tab.id)}
            className={[
              'flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors relative',
              isActive ? 'text-primary' : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            <span className={tab.id === 'add' ? 'text-xl leading-none' : ''}>
              {tab.label}
            </span>
            {/* Unread dot for activity tab */}
            {tab.id === 'activity' && activityUnread && (
              <span
                data-testid="tab-activity-unread-dot"
                className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
