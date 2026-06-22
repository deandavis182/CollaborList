/**
 * BottomTabBar — mobile bottom navigation.
 *
 * Props:
 *   activeTab  : 'home' | 'search' | 'add' | 'activity' | 'me'
 *   onSelect   : (tab: string) => void
 */

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'search', label: 'Search' },
  { id: 'add', label: '+' },
  { id: 'activity', label: 'Activity' },
  { id: 'me', label: 'Me' },
]

export function BottomTabBar({ activeTab, onSelect }) {
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
              'flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            <span className={tab.id === 'add' ? 'text-xl leading-none' : ''}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
