# CollaborList Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild CollaborList's mobile (`< md`) experience as a first-class, gesture-driven surface (Today triage home, Lists+search, List⇄Board detail with drag-reorder, quick-add FAB, bottom-sheet item detail, Activity, Me) while leaving the desktop (`md+`) layout completely untouched.

**Architecture:** The route table is unchanged. Each top-level route component branches on a new `useIsMobile()` hook: on mobile it renders a new screen under `src/features/mobile/`; on desktop it renders the existing component verbatim. `AppLayout` hides its desktop header on mobile and renders a floating `MobileTabBar` (Today · Lists · Activity · Me + center gradient FAB) plus two globally-mounted bottom sheets (item detail, quick-add). All new screens compose existing hooks (`useMyTasks`, `useListItems`, `useUpdateItem`, `useCreateItem`, `useWorkspaceMembers`, `useWorkspaceActivity`) and existing controls (`StatusControl`, `AssigneePicker`, `DueDateField`, `CommentThread`, `BoardView`, `Avatar`). The design reuses `tokens.css`; a small set of net-new tokens (brand gradient, soft tints, card shadow, tab-bar surface, scrim, extra radii) and the Bricolage Grotesque display font are added.

**Tech Stack:** React 18 + Vite 5, Tailwind 3, Zustand, @tanstack/react-query v5, @dnd-kit, Socket.io, Vitest + @testing-library/react. Display font via `@fontsource/bricolage-grotesque`.

## Global Constraints

- **Mobile is `< md` only.** Tailwind `md` breakpoint = `768px`. `useIsMobile()` = `matchMedia('(max-width: 767px)')`. Desktop (`md+`) code paths must not change behavior.
- **Status values are the exact strings** `'To do'`, `'Doing'`, `'Done'`, `'Blocked'` (case-sensitive). Status→color: `To do`→neutral, `Doing`→primary, `Done`→success, `Blocked`→danger.
- **Reuse `src/ui/tokens.css` tokens** (Tailwind names: `primary accent bg surface surface-2 text text-muted border success warning danger`). Soft tints = Tailwind opacity utilities (`bg-primary/10` etc.). No hardcoded hex in components except where a value comes straight off a record (e.g. a list/tag `color`).
- **Display font:** Bricolage Grotesque (700/800) for greetings, screen titles, big numbers, sheet titles. Self-hosted via `@fontsource`. Tailwind utility `font-display`.
- **Theme:** toggling Light/Dark sets `store.theme`; `providers.jsx` `ThemeWrapper` applies `data-theme`. Persist to `localStorage` key `theme`; initialise from it on load.
- **Status / list / project / due data** for a task come from `useMyTasks()` join fields: `list_id`, `list_name`, `project_id`, `project_name`, `workspace_id`, `due_date`, `status`, `completed`, `assignee_id`. Items do not carry a list color from the backend — derive a stable list color client-side via `listColor(list_id)` (Task 1).
- **Animations:** sheet in ~320ms `cubic-bezier(.32,.72,0,1)`; scrim fade 200ms; toast rise 300ms; reorder gap-shift 180ms; swipe spring-back 200ms; swipe-away 230ms.
- **Canonical design spec:** `Mobile views redesign/design_handoff_mobile_redesign/README.md` (sizes, radii, behaviors). The interactive prototype is `CollaborList Mobile.dc.html` (reference only — do not port its runtime).
- **Commits:** no `Co-Authored-By` trailer (project rule).
- **Tests:** Vitest. Run a single file with `cd frontend && npx vitest run <path>`. Run all with `cd frontend && npm test`.

---

## File Structure

**New files (all mobile concerns confined here):**
- `frontend/src/lib/useMediaQuery.js` — `useMediaQuery(query)` + `useIsMobile()`.
- `frontend/src/lib/listColor.js` — deterministic list color + soft-tint helpers + status color map.
- `frontend/src/features/mobile/MobileTabBar.jsx` — floating pill nav + center FAB.
- `frontend/src/features/mobile/MobileItemSheet.jsx` — global bottom-sheet host for item detail.
- `frontend/src/features/mobile/QuickAddSheet.jsx` — FAB capture sheet.
- `frontend/src/features/mobile/TodayScreen.jsx` — Today triage home.
- `frontend/src/features/mobile/SwipeableTaskCard.jsx` — swipe-to-triage card.
- `frontend/src/features/mobile/FocusCard.jsx` — gradient focus card + progress ring.
- `frontend/src/features/mobile/ListsScreen.jsx` — Lists index + search.
- `frontend/src/features/mobile/TaskResultRow.jsx` — search/result row treatment.
- `frontend/src/features/mobile/MobileListDetail.jsx` — list detail w/ List⇄Board lens.
- `frontend/src/features/mobile/MobileListLens.jsx` — reorderable list rows.
- `frontend/src/features/mobile/ActivityScreen.jsx` — mobile activity.
- `frontend/src/features/mobile/MeScreen.jsx` — profile + settings.
- Tests under `frontend/src/features/mobile/__tests__/` and `frontend/src/lib/__tests__/`.

**Modified files:**
- `frontend/src/ui/tokens.css` — net-new tokens (light + dark).
- `frontend/tailwind.config.js` — radii, fontFamily, backgroundImage, boxShadow, scrim/tabbar colors.
- `frontend/src/ui/Sheet.jsx` — add `variant="bottom"`.
- `frontend/src/lib/store.js` — `searchQuery`, `quickAddOpen`, `detailContext`, `openItem`, `setSearchQuery`, `setQuickAddOpen`, `setTheme` + persistence.
- `frontend/src/app/AppLayout.jsx` — responsive shell (hide header on mobile, mount MobileTabBar + global sheets).
- `frontend/src/app/routes.jsx` — add `/me` route; root + list + activity route components branch mobile/desktop.
- `frontend/src/features/tasks/MyTasksView.jsx`, `frontend/src/features/items/ListView.jsx`, `frontend/src/features/collab/ActivityFeed.jsx` — wrap with mobile branch (thin).
- `frontend/index.css` (or `main.jsx`) — import the font.
- `frontend/package.json` — add `@fontsource/bricolage-grotesque`.

---

## Task 1: Design tokens, Tailwind extension, and display font

**Files:**
- Modify: `frontend/src/ui/tokens.css`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/package.json` (add dependency) + `frontend/src/index.css` (import font + font-family vars)
- Create: `frontend/src/lib/listColor.js`
- Test: `frontend/src/ui/__tests__/tokens.test.jsx` (extend), `frontend/src/lib/__tests__/listColor.test.js`

**Interfaces:**
- Produces:
  - CSS vars (light `:root` + dark `[data-theme="dark"]`): `--gradient-brand`, `--tint-primary`, `--tint-accent`, `--tint-success`, `--tint-warning`, `--tint-danger`, `--shadow-card`, `--color-tabbar`, `--color-scrim`, `--font-display`.
  - Tailwind: `borderRadius` adds `xl:14px lg2:16px '2xl':18px '3xl':24px '4xl':28px`; `fontFamily.display`; `backgroundImage['brand-gradient']`; `boxShadow.card`; `colors.tabbar`, `colors.scrim`.
  - `listColor.js` exports: `listColor(id) → hsl string`, `listTint(id) → hsla string`, `STATUS_COLOR` (`{ 'To do':'neutral','Doing':'primary','Done':'success','Blocked':'danger' }`), `statusChipColor(status) → Chip color name`.

- [ ] **Step 1: Add the font dependency**

```bash
cd frontend && npm install @fontsource/bricolage-grotesque@5
```

- [ ] **Step 2: Import the font + define display family** in `frontend/src/index.css` (top of file, after existing Tailwind directives):

```css
@import '@fontsource/bricolage-grotesque/700.css';
@import '@fontsource/bricolage-grotesque/800.css';
```

- [ ] **Step 3: Add net-new tokens to `tokens.css`.** Inside `:root { … }` append:

```css
  /* ─── Mobile redesign — net-new ───────────────────────────── */
  --gradient-brand: linear-gradient(140deg,#8B7CFF 0%,#A579D6 48%,#C4788A 100%);
  --tint-primary: rgba(124,111,247,.13);
  --tint-accent:  rgba(196,120,138,.15);
  --tint-success: rgba(61,140,106,.14);
  --tint-warning: rgba(192,122,43,.15);
  --tint-danger:  rgba(192,68,58,.13);
  --shadow-card:  0 1px 2px rgba(34,32,30,.05), 0 6px 16px rgba(34,32,30,.06);
  --color-tabbar: rgba(255,255,255,.78);
  --color-scrim:  rgba(34,32,30,.32);
  --font-display: 'Bricolage Grotesque', -apple-system, system-ui, sans-serif;
```

Inside `[data-theme="dark"] { … }` append:

```css
  --gradient-brand: linear-gradient(140deg,#7E73E8 0%,#9A78C8 48%,#C77E90 100%);
  --tint-primary: rgba(157,150,255,.18);
  --tint-accent:  rgba(224,154,172,.18);
  --tint-success: rgba(74,168,126,.18);
  --tint-warning: rgba(192,122,43,.18);
  --tint-danger:  rgba(192,68,58,.18);
  --shadow-card:  0 1px 2px rgba(0,0,0,.4), 0 6px 16px rgba(0,0,0,.45);
  --color-tabbar: rgba(30,27,24,.78);
  --color-scrim:  rgba(0,0,0,.5);
```

- [ ] **Step 4: Extend `tailwind.config.js`** `theme.extend`:

```js
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px',
      },
      fontFamily: {
        display: 'var(--font-display)',
      },
      backgroundImage: {
        'brand-gradient': 'var(--gradient-brand)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      colors: {
        // ...existing...
        tabbar: 'var(--color-tabbar)',
        scrim: 'var(--color-scrim)',
      },
```

(Merge `tabbar`/`scrim` into the existing `colors` block; keep all current colors.)

- [ ] **Step 5: Write `frontend/src/lib/listColor.js`**

```js
// Deterministic list color + status helpers for the mobile redesign.
function djb2(str) {
  let h = 5381
  for (let i = 0; i < String(str).length; i++) h = (h * 33) ^ String(str).charCodeAt(i)
  return h >>> 0
}

export function listColor(id) {
  const hue = djb2(`list-${id}`) % 360
  return `hsl(${hue}, 52%, 52%)`
}

export function listTint(id) {
  const hue = djb2(`list-${id}`) % 360
  return `hsla(${hue}, 52%, 52%, 0.13)`
}

export const STATUS_COLOR = {
  'To do': 'neutral',
  Doing: 'primary',
  Done: 'success',
  Blocked: 'danger',
}

export function statusChipColor(status) {
  return STATUS_COLOR[status] ?? 'neutral'
}
```

- [ ] **Step 6: Write tests** `frontend/src/lib/__tests__/listColor.test.js`

```js
import { describe, it, expect } from 'vitest'
import { listColor, listTint, STATUS_COLOR, statusChipColor } from '../listColor.js'

describe('listColor', () => {
  it('is deterministic for the same id', () => {
    expect(listColor(7)).toBe(listColor(7))
  })
  it('returns an hsl string', () => {
    expect(listColor(7)).toMatch(/^hsl\(\d+, 52%, 52%\)$/)
  })
  it('listTint returns an hsla string', () => {
    expect(listTint(7)).toMatch(/^hsla\(\d+, 52%, 52%, 0\.13\)$/)
  })
})

describe('status color', () => {
  it('maps the four canonical statuses', () => {
    expect(STATUS_COLOR).toEqual({ 'To do': 'neutral', Doing: 'primary', Done: 'success', Blocked: 'danger' })
  })
  it('falls back to neutral', () => {
    expect(statusChipColor('Nope')).toBe('neutral')
    expect(statusChipColor('Doing')).toBe('primary')
  })
})
```

Add to `frontend/src/ui/__tests__/tokens.test.jsx` two cases asserting `--gradient-brand` appears in both the `:root` and `[data-theme="dark"]` blocks (mirror the existing `getBlock` helper usage in that file).

- [ ] **Step 7: Run tests**

Run: `cd frontend && npx vitest run src/lib/__tests__/listColor.test.js src/ui/__tests__/tokens.test.jsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/ui/tokens.css frontend/tailwind.config.js frontend/package.json frontend/package-lock.json frontend/src/index.css frontend/src/lib/listColor.js frontend/src/lib/__tests__/listColor.test.js frontend/src/ui/__tests__/tokens.test.jsx
git commit -m "feat(mobile): add redesign tokens, display font, and list-color helpers"
```

---

## Task 2: Responsive hook + store extensions

**Files:**
- Create: `frontend/src/lib/useMediaQuery.js`
- Modify: `frontend/src/lib/store.js`
- Test: `frontend/src/lib/__tests__/useMediaQuery.test.jsx`, extend `frontend/src/lib/__tests__/store.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `useMediaQuery(query: string) → boolean`, `useIsMobile() → boolean` (query `(max-width: 767px)`).
  - Store additions: `searchQuery: ''`, `setSearchQuery(q)`; `quickAddOpen: false`, `setQuickAddOpen(bool)`; `detailContext: null`, `openItem(id, ctx)` (sets `detailItemId` + `detailContext`), `closeDetail()` also clears `detailContext`; `setTheme(theme)` persists to `localStorage`; theme initialises from `localStorage.getItem('theme')` falling back to `'light'`.

- [ ] **Step 1: Write the failing test** `frontend/src/lib/__tests__/useMediaQuery.test.jsx`

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMediaQuery } from '../useMediaQuery.js'

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
}

describe('useMediaQuery', () => {
  beforeEach(() => mockMatchMedia(true))
  it('returns the initial match state', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(true)
  })
  it('returns false when not matching', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`useMediaQuery` not found).

Run: `cd frontend && npx vitest run src/lib/__tests__/useMediaQuery.test.jsx`

- [ ] **Step 3: Implement `frontend/src/lib/useMediaQuery.js`**

```js
import { useEffect, useState } from 'react'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (!window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Extend the store** in `frontend/src/lib/store.js`. Replace the `theme:` section and add the new fields. Change the create call's top so theme reads localStorage:

```js
function initialTheme() {
  if (typeof localStorage !== 'undefined') {
    const t = localStorage.getItem('theme')
    if (t === 'light' || t === 'dark') return t
  }
  return 'light'
}
```

Inside the store object, add/replace:

```js
  // Search (Lists screen, mobile)
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Quick-add sheet (mobile FAB)
  quickAddOpen: false,
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),

  // Detail context — list/workspace for the globally-mounted mobile item sheet
  detailContext: null,
  openItem: (id, ctx = null) => set({ detailItemId: id, detailContext: ctx }),

  // (replace existing closeDetail)
  closeDetail: () => set({ detailItemId: null, detailContext: null }),

  // Theme (replace existing theme + toggleTheme)
  theme: initialTheme(),
  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light'
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme)
      return { theme }
    }),
```

Keep existing `openDetail` (`(id) => set({ detailItemId: id })`) for desktop callers.

- [ ] **Step 6: Extend `frontend/src/lib/__tests__/store.test.js`** with cases:

```js
it('setSearchQuery updates searchQuery', () => {
  useStore.getState().setSearchQuery('cake')
  expect(useStore.getState().searchQuery).toBe('cake')
})
it('setQuickAddOpen toggles quickAddOpen', () => {
  useStore.getState().setQuickAddOpen(true)
  expect(useStore.getState().quickAddOpen).toBe(true)
})
it('openItem sets id and context; closeDetail clears both', () => {
  useStore.getState().openItem(5, { listId: 2, workspaceId: 9 })
  expect(useStore.getState().detailItemId).toBe(5)
  expect(useStore.getState().detailContext).toEqual({ listId: 2, workspaceId: 9 })
  useStore.getState().closeDetail()
  expect(useStore.getState().detailItemId).toBeNull()
  expect(useStore.getState().detailContext).toBeNull()
})
it('setTheme persists to localStorage', () => {
  useStore.getState().setTheme('dark')
  expect(localStorage.getItem('theme')).toBe('dark')
  expect(useStore.getState().theme).toBe('dark')
})
```

Ensure the test file's `beforeEach` reset block includes the new fields (`searchQuery: ''`, `quickAddOpen: false`, `detailContext: null`).

- [ ] **Step 7: Run** `cd frontend && npx vitest run src/lib/__tests__/store.test.js src/lib/__tests__/useMediaQuery.test.jsx` — expect PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/useMediaQuery.js frontend/src/lib/store.js frontend/src/lib/__tests__/useMediaQuery.test.jsx frontend/src/lib/__tests__/store.test.js
git commit -m "feat(mobile): add useIsMobile hook and store fields for search, quick-add, item context, theme persistence"
```

---

## Task 3: `Sheet` bottom-sheet variant

**Files:**
- Modify: `frontend/src/ui/Sheet.jsx`
- Test: extend `frontend/src/ui/__tests__/Sheet.test.jsx` (create if absent)

**Interfaces:**
- Consumes: nothing.
- Produces: `Sheet` accepts `variant="bottom"`. Bottom variant renders: a scrim (`bg-scrim`, fade 200ms) and a panel anchored to the bottom (`fixed inset-x-0 bottom-0`, `rounded-t-4xl`, `max-h-[86%]`, slide-up via `cubic-bezier(.32,.72,0,1)` ~320ms), a 40×5px grab handle at top (`data-testid="sheet-grab"`), and an optional title. Scrim click and Escape close. Keeps `data-testid="sheet-backdrop"` and `data-testid="sheet-panel"`. Existing `drawer`/`fullscreen` variants unchanged.

- [ ] **Step 1: Write the failing test** (append to `Sheet.test.jsx`)

```jsx
import { render, screen } from '@testing-library/react'
import { Sheet } from '../Sheet.jsx'
// ...
it('bottom variant renders a grab handle and bottom-anchored panel', () => {
  render(<Sheet variant="bottom" open onClose={() => {}} title="Detail"><p>body</p></Sheet>)
  expect(screen.getByTestId('sheet-grab')).toBeInTheDocument()
  const panel = screen.getByTestId('sheet-panel')
  expect(panel.className).toMatch(/rounded-t-4xl/)
  expect(panel.className).toMatch(/bottom-0/)
})
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `cd frontend && npx vitest run src/ui/__tests__/Sheet.test.jsx`

- [ ] **Step 3: Implement.** In `Sheet.jsx`, add the bottom branch. Replace the `panelClasses` computation:

```jsx
  const panelClasses =
    variant === 'fullscreen'
      ? 'fixed inset-0 z-50 flex flex-col bg-surface overflow-y-auto'
      : variant === 'bottom'
        ? 'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-surface rounded-t-4xl max-h-[86%] overflow-y-auto shadow-xl animate-[sheet-up_320ms_cubic-bezier(.32,.72,0,1)]'
        : 'fixed top-0 right-0 h-full z-50 flex flex-col bg-surface border-l border-border shadow-xl w-full max-w-md overflow-y-auto'
```

Change the backdrop class to use the scrim token for the bottom variant:

```jsx
      <div
        className={variant === 'bottom' ? 'fixed inset-0 z-40 bg-scrim' : 'fixed inset-0 z-40 bg-black/40'}
        aria-hidden="true"
        onClick={onClose}
        data-testid="sheet-backdrop"
      />
```

Inside the panel, when `variant === 'bottom'`, render the grab handle as the first child (before the header):

```jsx
        {variant === 'bottom' && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <span data-testid="sheet-grab" className="w-10 h-[5px] rounded-full bg-surface-2" />
          </div>
        )}
```

Add the keyframe to `frontend/src/index.css`:

```css
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

- [ ] **Step 4: Run — expect PASS.** Also run the full `Sheet` test file to confirm drawer/fullscreen unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/Sheet.jsx frontend/src/ui/__tests__/Sheet.test.jsx frontend/src/index.css
git commit -m "feat(ui): add bottom-sheet variant to Sheet"
```

---

## Task 4: `MobileTabBar`

**Files:**
- Create: `frontend/src/features/mobile/MobileTabBar.jsx`
- Test: `frontend/src/features/mobile/__tests__/MobileTabBar.test.jsx`

**Interfaces:**
- Consumes: nothing (pure presentational).
- Produces: `MobileTabBar({ activeTab, onSelect, onAdd, activityUnread })`. `activeTab ∈ 'today'|'lists'|'activity'|'me'`. Renders four labeled tabs (Today · Lists · Activity · Me) each with a 9px square indicator (filled `bg-primary` + glow when active, `bg-text-muted/40` when not) above a `10.5px/700` label, and a center raised 54px gradient FAB. testids: `mobile-tab-bar`, `mtab-today|mtab-lists|mtab-activity|mtab-me`, `mtab-add`, `mtab-activity-unread`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileTabBar } from '../MobileTabBar.jsx'

describe('MobileTabBar', () => {
  it('renders four tabs + FAB and marks the active tab', () => {
    render(<MobileTabBar activeTab="lists" onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument()
    expect(screen.getByTestId('mtab-add')).toBeInTheDocument()
    expect(screen.getByTestId('mtab-lists')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('mtab-today')).not.toHaveAttribute('aria-current')
  })
  it('calls onSelect with the tab id and onAdd for the FAB', () => {
    const onSelect = vi.fn(); const onAdd = vi.fn()
    render(<MobileTabBar activeTab="today" onSelect={onSelect} onAdd={onAdd} />)
    fireEvent.click(screen.getByTestId('mtab-activity'))
    expect(onSelect).toHaveBeenCalledWith('activity')
    fireEvent.click(screen.getByTestId('mtab-add'))
    expect(onAdd).toHaveBeenCalled()
  })
  it('shows the unread dot when activityUnread', () => {
    render(<MobileTabBar activeTab="today" onSelect={() => {}} onAdd={() => {}} activityUnread />)
    expect(screen.getByTestId('mtab-activity-unread')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `MobileTabBar.jsx`

```jsx
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
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile/MobileTabBar.jsx frontend/src/features/mobile/__tests__/MobileTabBar.test.jsx
git commit -m "feat(mobile): add floating MobileTabBar with center FAB"
```

---

## Task 5: Responsive `AppLayout` shell + global mobile sheets

**Files:**
- Modify: `frontend/src/app/AppLayout.jsx`
- Create: `frontend/src/features/mobile/MobileItemSheet.jsx` (stub — full body in Task 12)
- Create: `frontend/src/features/mobile/QuickAddSheet.jsx` (stub — full body in Task 13)
- Modify: `frontend/src/app/routes.jsx` (add `/me` route)
- Test: extend `frontend/src/app/__tests__/AppLayout.test.jsx`

**Interfaces:**
- Consumes: `useIsMobile` (Task 2), `MobileTabBar` (Task 4), store `quickAddOpen`/`setQuickAddOpen`/`detailItemId`.
- Produces: On mobile, `AppLayout` hides the desktop `<header>` and the sidebar, renders `<MobileTabBar>` (replacing the old `<BottomTabBar>`) wired to routes, and mounts `<MobileItemSheet>` + `<QuickAddSheet>` once. On desktop, layout is unchanged. New route `/me` → `MeScreen` (Task 15; stub acceptable until then).

- [ ] **Step 1: Create stubs** so the shell compiles. `MobileItemSheet.jsx`:

```jsx
export function MobileItemSheet() { return null }
```

`QuickAddSheet.jsx`:

```jsx
export function QuickAddSheet() { return null }
```

- [ ] **Step 2: Write the failing test** (extend AppLayout test). Mock `useIsMobile` to `true` and assert the desktop header is absent and the mobile tab bar is present; mock to `false` and assert the reverse.

```jsx
vi.mock('../../lib/useMediaQuery.js', () => ({ useIsMobile: vi.fn() }))
import { useIsMobile } from '../../lib/useMediaQuery.js'
// ...
it('mobile: shows MobileTabBar and hides the desktop header', () => {
  useIsMobile.mockReturnValue(true)
  renderLayout() // existing helper that wraps with providers + router
  expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument()
  expect(screen.queryByTestId('app-header')).not.toBeInTheDocument()
})
it('desktop: shows the header and not the mobile tab bar', () => {
  useIsMobile.mockReturnValue(false)
  renderLayout()
  expect(screen.getByTestId('app-header')).toBeInTheDocument()
  expect(screen.queryByTestId('mobile-tab-bar')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement the responsive shell** in `AppLayout.jsx`. Add imports:

```jsx
import { useIsMobile } from '../lib/useMediaQuery.js'
import { MobileTabBar } from '../features/mobile/MobileTabBar.jsx'
import { MobileItemSheet } from '../features/mobile/MobileItemSheet.jsx'
import { QuickAddSheet } from '../features/mobile/QuickAddSheet.jsx'
```

Compute mobile state + active tab + handlers:

```jsx
  const isMobile = useIsMobile()
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen)

  let mobileTab = 'lists'
  if (path === '/my-tasks') mobileTab = 'today'
  else if (path === '/') mobileTab = 'lists'
  else if (path.endsWith('/activity')) mobileTab = 'activity'
  else if (path === '/me') mobileTab = 'me'

  function handleMobileSelect(tab) {
    if (tab === 'today') navigate('/my-tasks')
    else if (tab === 'lists') navigate('/')
    else if (tab === 'activity') { if (currentWorkspaceId) navigate(`/w/${currentWorkspaceId}/activity`) }
    else if (tab === 'me') navigate('/me')
  }
```

Render: wrap the existing `<header>` element in `{!isMobile && ( … )}`. Wrap the sidebar `<div data-testid="sidebar-container">` so it stays `hidden md:flex` (already mobile-hidden — leave as is). Replace the bottom `<div data-testid="bottom-bar-container">…<BottomTabBar/></div>` block with:

```jsx
      {isMobile && (
        <>
          <MobileTabBar
            activeTab={mobileTab}
            onSelect={handleMobileSelect}
            onAdd={() => setQuickAddOpen(true)}
            activityUnread={activityUnread}
          />
          <MobileItemSheet />
          <QuickAddSheet />
        </>
      )}
```

Keep `<main>` but give it mobile-safe full height (the floating bar overlays content; screens add their own bottom padding). No change needed to `<main>` classes.

- [ ] **Step 5: Add the `/me` route** in `routes.jsx`. Import a `MeScreen` (stub until Task 15 — create `MeScreen` returning `<div data-testid="me-screen" />` if Task 15 not yet done, or rely on Task 15 ordering). Add inside the authenticated `<AppLayout>` children route list:

```jsx
<Route path="/me" element={<MeScreen />} />
```

- [ ] **Step 6: Run — expect PASS.** Run the full app-layout + routes test files to confirm desktop unaffected.

Run: `cd frontend && npx vitest run src/app/__tests__/AppLayout.test.jsx src/app/__tests__/routes.test.jsx`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/AppLayout.jsx frontend/src/app/routes.jsx frontend/src/features/mobile/MobileItemSheet.jsx frontend/src/features/mobile/QuickAddSheet.jsx frontend/src/app/__tests__/AppLayout.test.jsx
git commit -m "feat(mobile): responsive AppLayout shell with MobileTabBar and global sheets"
```

---

## Task 6: `FocusCard` + `TodayScreen` (static)

**Files:**
- Create: `frontend/src/features/mobile/FocusCard.jsx`, `frontend/src/features/mobile/TodayScreen.jsx`
- Modify: `frontend/src/features/tasks/MyTasksView.jsx` (mobile branch)
- Test: `frontend/src/features/mobile/__tests__/FocusCard.test.jsx`, `frontend/src/features/mobile/__tests__/TodayScreen.test.jsx`

**Interfaces:**
- Consumes: `useMyTasks` (returns `Task[]`), `groupTasksByDue(tasks) → { overdue, today, upcoming, noDate }`, `getUser()` from `lib/auth.js` (`{ email }`), `listColor`, `statusChipColor`, `Avatar`, `Chip`, store `openItem`.
- Produces:
  - `FocusCard({ percent, headline, subline })` — gradient card with a 74px conic progress ring.
  - `TodayScreen()` — full Today screen: header row (date + greeting + avatar→/me), `<FocusCard>`, and sections Overdue/Today/Upcoming/Someday rendered only when non-empty, each a status dot + uppercase label + count, with task cards (static here; swipe added Task 7). Each card calls `openItem(task.id, { listId: task.list_id, workspaceId: task.workspace_id })` on tap.

- [ ] **Step 1: Write the failing test** for `FocusCard`:

```jsx
import { render, screen } from '@testing-library/react'
import { FocusCard } from '../FocusCard.jsx'
it('renders percent, headline and subline', () => {
  render(<FocusCard percent={75} headline="4 tasks need you today" subline="1 overdue · 3 due today" />)
  expect(screen.getByText('75')).toBeInTheDocument()
  expect(screen.getByText('4 tasks need you today')).toBeInTheDocument()
  expect(screen.getByText('1 overdue · 3 due today')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `FocusCard.jsx`**

```jsx
export function FocusCard({ percent = 0, headline, subline }) {
  const deg = Math.round(percent * 3.6)
  return (
    <div
      data-testid="focus-card"
      className="relative overflow-hidden rounded-3xl p-5 text-white bg-brand-gradient shadow-[0_10px_28px_rgba(124,111,247,.32)]"
    >
      <span aria-hidden="true" className="absolute -top-10 -right-8 w-[150px] h-[150px] rounded-full bg-white/15" />
      <div className="relative flex items-center gap-4">
        <div
          className="w-[74px] h-[74px] rounded-full grid place-items-center shrink-0"
          style={{ background: `conic-gradient(#fff ${deg}deg, rgba(255,255,255,.28) 0)` }}
        >
          <div className="w-[58px] h-[58px] rounded-full bg-[rgba(0,0,0,.12)] grid place-items-center text-center leading-none">
            <div>
              <div className="text-lg font-bold font-display">{percent}</div>
              <div className="text-[9px] font-bold tracking-wider opacity-80">DONE</div>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold tracking-wide uppercase opacity-80">Today's focus</div>
          <div className="text-[17px] font-bold font-display leading-tight mt-0.5">{headline}</div>
          <div className="text-[12.5px] opacity-85 mt-0.5">{subline}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Write the failing test** for `TodayScreen` (mock `useMyTasks` + `lib/auth`):

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('../../../lib/api.js', () => ({ useMyTasks: vi.fn() }))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ email: 'devin@example.com' }) }))
import { useMyTasks } from '../../../lib/api.js'
import { TodayScreen } from '../TodayScreen.jsx'

describe('TodayScreen', () => {
  beforeEach(() => {
    useMyTasks.mockReturnValue({ data: [
      { id: 1, text: 'Overdue thing', list_id: 2, list_name: 'Venue', workspace_id: 9, status: 'To do', completed: false, due_date: '2020-01-01' },
      { id: 2, text: 'Someday thing', list_id: 3, list_name: 'Ideas', workspace_id: 9, status: 'To do', completed: false, due_date: null },
    ], isLoading: false })
  })
  it('renders the greeting, focus card, and a section per non-empty bucket', () => {
    render(<TodayScreen />)
    expect(screen.getByTestId('today-screen')).toBeInTheDocument()
    expect(screen.getByTestId('focus-card')).toBeInTheDocument()
    expect(screen.getByText(/overdue/i)).toBeInTheDocument()
    expect(screen.getByText('Overdue thing')).toBeInTheDocument()
    expect(screen.getByText('Someday thing')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run — expect FAIL.**

- [ ] **Step 7: Implement `TodayScreen.jsx`.** Greeting from local hour; sections config; cards static (swipe layered in Task 7 by swapping the card element). Note bottom padding `pb-[116px]`, top `pt-[62px]`, side `px-[18px]`, section gap via `space-y-[22px]`.

```jsx
import { useMyTasks } from '../../lib/api.js'
import { groupTasksByDue } from '../tasks/groupTasks.js'
import { getUser } from '../../lib/auth.js'
import { useStore } from '../../lib/store.js'
import { FocusCard } from './FocusCard.jsx'
import { TaskCard } from './SwipeableTaskCard.jsx' // Task 7 exports TaskCard; until then use a local card

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

export function TodayScreen() {
  const { data: tasks = [] } = useMyTasks()
  const openItem = useStore((s) => s.openItem)
  const user = getUser()
  const groups = groupTasksByDue(tasks)

  const openOverdue = groups.overdue.length
  const openToday = groups.today.filter((t) => !t.completed).length
  const completedToday = tasks.filter((t) => t.completed && (t.due_date || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length
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

import { Avatar } from '../../ui/Avatar.jsx'
function AvatarInline({ name }) { return <Avatar name={name} size="md" /> }
```

(If Task 7 is not yet implemented, define a temporary local `TaskCard` here that renders the card statically; Task 7 replaces the import with the swipeable version. Prefer implementing Task 7 immediately after.)

- [ ] **Step 8: Wire the mobile branch in `MyTasksView.jsx`.** At the top of the component:

```jsx
import { useIsMobile } from '../../lib/useMediaQuery.js'
import { TodayScreen } from '../mobile/TodayScreen.jsx'
// inside component, first line of the return logic:
if (useIsMobile()) return <TodayScreen />
```

(Keep the entire existing desktop body below, unchanged.)

- [ ] **Step 9: Run** `cd frontend && npx vitest run src/features/mobile/__tests__/FocusCard.test.jsx src/features/mobile/__tests__/TodayScreen.test.jsx` — expect PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/mobile/FocusCard.jsx frontend/src/features/mobile/TodayScreen.jsx frontend/src/features/tasks/MyTasksView.jsx frontend/src/features/mobile/__tests__/FocusCard.test.jsx frontend/src/features/mobile/__tests__/TodayScreen.test.jsx
git commit -m "feat(mobile): Today screen with gradient focus card and due-grouped sections"
```

---

## Task 7: `SwipeableTaskCard` (swipe-to-triage)

**Files:**
- Create: `frontend/src/features/mobile/SwipeableTaskCard.jsx`
- Test: `frontend/src/features/mobile/__tests__/SwipeableTaskCard.test.jsx`

**Interfaces:**
- Consumes: `useUpdateItem(listId)` (mutation accepts `{ id, completed, due_date }`), `listColor`, `statusChipColor`, `Chip`.
- Produces: `TaskCard({ task, onOpen })` — the card used by `TodayScreen`. Behavior: pointer drag; decide axis on first move (vertical → let scroll, abort gesture). Translate foreground with finger; reveal green "✓ Done" (right drag) / amber "Tomorrow →" (left drag). Release past ±78px → animate off (`translateX(±115%); opacity:0`, 230ms) then commit: right = `useUpdateItem({ id, completed: true })`; left = `useUpdateItem({ id, due_date: <task.due_date or today + 1 day> })`. Under threshold → spring back (200ms). A tap (total movement < 6px) → `onOpen()`. testid `task-card-${task.id}`, `swipe-fg-${task.id}`.

- [ ] **Step 1: Write the failing test.** Mock `useUpdateItem`; simulate a right-swipe past threshold by firing pointer events and asserting the mutation fires with `{ completed: true }`. Use `getBoundingClientRect` defaults (jsdom returns 0s — drive deltas via clientX).

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const mutate = vi.fn()
vi.mock('../../../lib/api.js', () => ({ useUpdateItem: () => ({ mutate }) }))
import { TaskCard } from '../SwipeableTaskCard.jsx'

const task = { id: 5, text: 'Call florist', list_id: 2, list_name: 'Venue', workspace_id: 9, status: 'To do', completed: false, due_date: '2026-06-24' }

describe('SwipeableTaskCard', () => {
  beforeEach(() => mutate.mockClear())
  it('renders the title and a list chip', () => {
    render(<TaskCard task={task} onOpen={() => {}} />)
    expect(screen.getByText('Call florist')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
  })
  it('a tap (no movement) calls onOpen', () => {
    const onOpen = vi.fn()
    render(<TaskCard task={task} onOpen={onOpen} />)
    const fg = screen.getByTestId('swipe-fg-5')
    fireEvent.pointerDown(fg, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(fg, { clientX: 11, clientY: 10, pointerId: 1 })
    expect(onOpen).toHaveBeenCalled()
  })
  it('a right swipe past threshold marks complete', () => {
    vi.useFakeTimers()
    render(<TaskCard task={task} onOpen={() => {}} />)
    const fg = screen.getByTestId('swipe-fg-5')
    fireEvent.pointerDown(fg, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(fg, { clientX: 120, clientY: 12, pointerId: 1 })
    fireEvent.pointerUp(fg, { clientX: 120, clientY: 12, pointerId: 1 })
    vi.advanceTimersByTime(260)
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 5, completed: true }))
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `SwipeableTaskCard.jsx`.** Manipulate the foreground node's transform imperatively during the gesture; only `setState`/mutate on commit.

```jsx
import { useRef } from 'react'
import { useUpdateItem } from '../../lib/api.js'
import { Chip } from '../../ui/Chip.jsx'
import { listColor, statusChipColor } from '../../lib/listColor.js'

const THRESHOLD = 78
function nextDay(due) {
  const base = due ? new Date(due + 'T00:00:00') : new Date()
  base.setDate(base.getDate() + 1)
  return base.toISOString().slice(0, 10)
}

export function TaskCard({ task, onOpen }) {
  const { mutate } = useUpdateItem(task.list_id)
  const fgRef = useRef(null)
  const state = useRef({ active: false, axis: null, startX: 0, startY: 0, dx: 0 })

  function onPointerDown(e) {
    state.current = { active: true, axis: null, startX: e.clientX, startY: e.clientY, dx: 0 }
    fgRef.current?.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    const s = state.current
    if (!s.active) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (!s.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (s.axis === 'y') { s.active = false; return } // let the list scroll
    }
    s.dx = dx
    if (fgRef.current) {
      fgRef.current.style.transition = 'none'
      fgRef.current.style.transform = `translateX(${dx}px)`
    }
  }
  function onPointerUp() {
    const s = state.current
    if (!s.active) { state.current.active = false; return }
    s.active = false
    const dx = s.dx
    const fg = fgRef.current
    if (Math.abs(dx) < 6 && s.axis !== 'x') { onOpen?.(); return }
    if (Math.abs(dx) >= THRESHOLD) {
      const dir = dx > 0 ? 1 : -1
      if (fg) {
        fg.style.transition = 'transform 230ms ease, opacity 230ms ease'
        fg.style.transform = `translateX(${dir * 115}%)`
        fg.style.opacity = '0'
      }
      setTimeout(() => {
        if (dir > 0) mutate({ id: task.id, completed: true })
        else mutate({ id: task.id, due_date: nextDay(task.due_date) })
      }, 240)
    } else {
      if (fg) { fg.style.transition = 'transform 200ms ease'; fg.style.transform = 'translateX(0)' }
      if (Math.abs(dx) < 6) onOpen?.()
    }
  }

  return (
    <div data-testid={`task-card-${task.id}`} className="relative rounded-2xl overflow-hidden" style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-0 flex items-center justify-between px-4 text-[13px] font-bold">
        <span className="text-success">✓ Done</span>
        <span className="text-warning">Tomorrow →</span>
      </div>
      <div
        ref={fgRef}
        data-testid={`swipe-fg-${task.id}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative bg-surface border border-border shadow-card rounded-2xl px-[14px] py-[13px] flex items-start gap-3"
      >
        <button
          type="button"
          aria-label={task.completed ? 'Completed' : 'Mark complete'}
          onClick={(e) => { e.stopPropagation(); mutate({ id: task.id, completed: !task.completed }) }}
          className={['w-[22px] h-[22px] rounded-full border-2 shrink-0 mt-0.5', task.completed ? 'bg-success border-success' : 'border-border'].join(' ')}
        />
        <div className="min-w-0 flex-1">
          <div className={['text-[15px] font-semibold', task.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{task.text}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: listColor(task.list_id) }} />
              {task.list_name}
            </span>
            {task.status && task.status !== 'To do' && <Chip color={statusChipColor(task.status)}>{task.status}</Chip>}
            {task.due_date && <Chip color="neutral">{task.due_date.slice(5)}</Chip>}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** Update `TodayScreen` to import `TaskCard` from this file (remove any temporary local card).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile/SwipeableTaskCard.jsx frontend/src/features/mobile/__tests__/SwipeableTaskCard.test.jsx frontend/src/features/mobile/TodayScreen.jsx
git commit -m "feat(mobile): swipe-to-triage task cards (complete / snooze to tomorrow)"
```

---

## Task 8: `ListsScreen` (cards) + `TaskResultRow`

**Files:**
- Create: `frontend/src/features/mobile/ListsScreen.jsx`, `frontend/src/features/mobile/TaskResultRow.jsx`
- Modify: `frontend/src/app/routes.jsx` (root route branches to ListsScreen on mobile) **or** wrap in the existing root component
- Test: `frontend/src/features/mobile/__tests__/ListsScreen.test.jsx`, `frontend/src/features/mobile/__tests__/TaskResultRow.test.jsx`

**Interfaces:**
- Consumes: `useMyTasks` (to derive lists + progress without an N-query fan-out), `listColor`, `statusChipColor`, `Chip`, `Avatar`, store `searchQuery`/`setSearchQuery`/`openItem`, `useNavigate`.
- Produces:
  - `TaskResultRow({ task, showListContext, onOpen })` — a result row: checkbox-style dot + title + chips (optional list-context pill + status + due) + optional assignee avatar.
  - `ListsScreen()` — "Lists" title, search bar, then **either** search results (when `searchQuery` non-empty) **or** list cards. List cards derive from distinct `list_id` in `useMyTasks` with open/total counts and a progress fill. Tapping a card navigates to that list's detail route; tapping a result opens the item sheet.

- [ ] **Step 1: Write the failing test** for `TaskResultRow`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { TaskResultRow } from '../TaskResultRow.jsx'
const task = { id: 3, text: 'Book DJ', list_id: 2, list_name: 'Vendors', status: 'Doing', due_date: '2026-07-01', assignee_id: null, completed: false }
it('shows the title and the list-context pill when enabled', () => {
  render(<TaskResultRow task={task} showListContext onOpen={() => {}} />)
  expect(screen.getByText('Book DJ')).toBeInTheDocument()
  expect(screen.getByText('Vendors')).toBeInTheDocument()
})
it('calls onOpen when tapped', () => {
  const onOpen = vi.fn()
  render(<TaskResultRow task={task} onOpen={onOpen} />)
  fireEvent.click(screen.getByTestId('result-row-3'))
  expect(onOpen).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `TaskResultRow.jsx`**

```jsx
import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { listColor, statusChipColor } from '../../lib/listColor.js'

export function TaskResultRow({ task, showListContext = false, assigneeEmail, onOpen }) {
  return (
    <button
      type="button"
      data-testid={`result-row-${task.id}`}
      onClick={onOpen}
      className="w-full flex items-center gap-3 py-[13px] px-1 text-left border-b border-border"
    >
      <span className={['w-[22px] h-[22px] rounded-full border-2 shrink-0', task.completed ? 'bg-success border-success' : 'border-border'].join(' ')} />
      <span className="min-w-0 flex-1">
        <span className={['block text-[15px] font-semibold truncate', task.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{task.text}</span>
        <span className="flex items-center gap-1.5 flex-wrap mt-1">
          {showListContext && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: listColor(task.list_id) }} />
              {task.list_name}
            </span>
          )}
          {task.status && task.status !== 'To do' && <Chip color={statusChipColor(task.status)}>{task.status}</Chip>}
          {task.due_date && <Chip color="neutral">{task.due_date.slice(5)}</Chip>}
        </span>
      </span>
      {task.assignee_id != null && <Avatar name={assigneeEmail || String(task.assignee_id)} size="sm" />}
    </button>
  )
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Write the failing test** for `ListsScreen` (mock `useMyTasks`, `react-router-dom` `useNavigate`, store). Assert list cards render with counts, and that typing into search switches to results.

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('../../../lib/api.js', () => ({ useMyTasks: vi.fn() }))
const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
import { useMyTasks } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ListsScreen } from '../ListsScreen.jsx'

describe('ListsScreen', () => {
  beforeEach(() => {
    useStore.setState({ searchQuery: '', detailItemId: null, detailContext: null })
    useMyTasks.mockReturnValue({ data: [
      { id: 1, text: 'A', list_id: 2, list_name: 'Venue', project_name: 'Wedding', workspace_id: 9, project_id: 4, completed: false, status: 'To do', due_date: null },
      { id: 2, text: 'B', list_id: 2, list_name: 'Venue', project_name: 'Wedding', workspace_id: 9, project_id: 4, completed: true, status: 'Done', due_date: null },
    ], isLoading: false })
  })
  it('shows a list card with open/total progress', () => {
    render(<ListsScreen />)
    expect(screen.getByTestId('lists-screen')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
    expect(screen.getByTestId('list-card-2')).toBeInTheDocument()
  })
  it('switches to search results when the query matches', () => {
    render(<ListsScreen />)
    fireEvent.change(screen.getByTestId('mobile-search-input'), { target: { value: 'A' } })
    expect(screen.getByText(/result/i)).toBeInTheDocument()
    expect(screen.getByTestId('result-row-1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run — expect FAIL.**

- [ ] **Step 7: Implement `ListsScreen.jsx`.** Derive lists by reducing tasks by `list_id`. Search filter is wired here but fully specified in Task 9 — implement the same filter now (text/list/project/assignee match) so both tasks share one code path.

```jsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyTasks } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { listColor } from '../../lib/listColor.js'
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
                  <span className="w-[38px] h-[38px] rounded-[11px] grid place-items-center shrink-0" style={{ background: `${listColor(l.id)}22` }}>
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
```

- [ ] **Step 8: Branch the root route to `ListsScreen` on mobile.** In `routes.jsx`, the index/`/` element currently renders `MyTasksView`. Wrap it in a tiny inline component or modify `MyTasksView` to render `ListsScreen` when mobile **at `/`** vs `TodayScreen` at `/my-tasks`. Cleanest: create a `RootRoute` component in `routes.jsx`:

```jsx
function RootRoute() {
  const isMobile = useIsMobile()
  if (isMobile) return <ListsScreen />
  return <MyTasksView />
}
// index route: <Route index element={<RootRoute />} />  and  <Route path="/" ... /> as appropriate
```

(`/my-tasks` keeps rendering `MyTasksView`, which itself renders `TodayScreen` on mobile per Task 6.)

- [ ] **Step 9: Run** the two new test files — expect PASS. Run `routes.test.jsx` to confirm desktop root still shows MyTasks.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/mobile/ListsScreen.jsx frontend/src/features/mobile/TaskResultRow.jsx frontend/src/app/routes.jsx frontend/src/features/mobile/__tests__/ListsScreen.test.jsx frontend/src/features/mobile/__tests__/TaskResultRow.test.jsx
git commit -m "feat(mobile): Lists screen with progress cards and live cross-list search"
```

---

## Task 9: Search polish (assignee match + empty states)

**Files:**
- Modify: `frontend/src/features/mobile/ListsScreen.jsx` (enrich tasks with `assignee_email` for search + result avatars)
- Test: extend `frontend/src/features/mobile/__tests__/ListsScreen.test.jsx`

**Interfaces:**
- Consumes: `useWorkspaceMembers(workspaceId)` (`[{user_id, email}]`) to resolve `assignee_id → email` so search matches people and result rows show the right avatar.
- Produces: search matches assignee email; result rows pass `assigneeEmail` to `TaskResultRow`.

- [ ] **Step 1: Write the failing test** — a task assigned to a member whose email contains the query appears in results even though the text doesn't match.

```jsx
it('matches tasks by assignee email', () => {
  useStore.setState({ searchQuery: 'bridesmaid' })
  useMyTasks.mockReturnValue({ data: [{ id: 7, text: 'Pick shoes', list_id: 2, list_name: 'Venue', workspace_id: 9, project_id: 4, assignee_id: 11, completed: false, status: 'To do', due_date: null }], isLoading: false })
  // member 11 -> bridesmaid@example.com (mock useWorkspaceMembers)
  render(<ListsScreen />)
  expect(screen.getByTestId('result-row-7')).toBeInTheDocument()
})
```

Add `vi.mock` for `useWorkspaceMembers` returning `{ data: [{ user_id: 11, email: 'bridesmaid@example.com' }] }` and include it in the `api.js` mock factory.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** In `ListsScreen`, read `currentWorkspaceId` from store, call `useWorkspaceMembers(currentWorkspaceId)`, build `emailById`, and map tasks to include `assignee_email` before `filterTasks`/render:

```jsx
const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
const { data: members = [] } = useWorkspaceMembers(currentWorkspaceId)
const emailById = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m.email])), [members])
const enriched = useMemo(() => tasks.map((t) => ({ ...t, assignee_email: emailById[t.assignee_id] })), [tasks, emailById])
// use `enriched` for deriveLists, filterTasks, and pass assigneeEmail={t.assignee_email}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile/ListsScreen.jsx frontend/src/features/mobile/__tests__/ListsScreen.test.jsx
git commit -m "feat(mobile): search matches assignee names and shows assignee avatars"
```

---

## Task 10: `MobileListDetail` (List ⇄ Board lens)

**Files:**
- Create: `frontend/src/features/mobile/MobileListDetail.jsx`
- Modify: `frontend/src/features/items/ListView.jsx` (mobile branch)
- Test: `frontend/src/features/mobile/__tests__/MobileListDetail.test.jsx`

**Interfaces:**
- Consumes: `useListItems(listId)`, `useWorkspaceMembers(workspaceId)`, `useUpdateItem(listId)` (for `onMove` status changes from Board), `BoardView` (props `{ items, members, groupMode:'status', onMove, onOpen }`), `SegmentedControl`, `useParams`/`useNavigate`, store `openItem`.
- Produces: `MobileListDetail()` — reads `:workspaceId/:projectId/:listId` from the route; renders a non-scrolling header (back button `‹`, list name + project, a `List / Board` `SegmentedControl`), then the active lens fills remaining height. Board lens = `<BoardView>` (compact mobile card styling applied via its existing classes; no structural change). List lens = `<MobileListLens>` (Task 11). `onMove({ id, status })` → `useUpdateItem`. Opening an item → `openItem(id, { listId, workspaceId })`.

- [ ] **Step 1: Write the failing test** (mock hooks + router params). Assert header renders the segmented control and switching to Board shows `board-view`.

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('react-router-dom', () => ({ useParams: () => ({ workspaceId: '9', projectId: '4', listId: '2' }), useNavigate: () => vi.fn() }))
vi.mock('../../../lib/api.js', () => ({
  useListItems: () => ({ data: [{ id: 1, list_id: 2, text: 'Item', status: 'To do', completed: false, position: 1000 }], isLoading: false }),
  useWorkspaceMembers: () => ({ data: [] }),
  useUpdateItem: () => ({ mutate: vi.fn() }),
}))
import { MobileListDetail } from '../MobileListDetail.jsx'

describe('MobileListDetail', () => {
  it('renders the lens toggle and switches to Board', () => {
    render(<MobileListDetail />)
    expect(screen.getByTestId('mobile-list-detail')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    expect(screen.getByTestId('board-view')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `MobileListDetail.jsx`**

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useListItems, useWorkspaceMembers, useUpdateItem } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { BoardView } from '../views/BoardView.jsx'
import { MobileListLens } from './MobileListLens.jsx'

const LENS = [{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }]

export function MobileListDetail() {
  const { workspaceId, projectId, listId } = useParams()
  const navigate = useNavigate()
  const [lens, setLens] = useState('list')
  const { data: items = [] } = useListItems(listId)
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const { mutate: updateItem } = useUpdateItem(listId)
  const openItem = useStore((s) => s.openItem)

  const onOpen = (id) => openItem(id, { listId: Number(listId), workspaceId: Number(workspaceId) })
  const onMove = ({ id, ...changes }) => updateItem({ id, ...changes })
  const listName = items[0]?.list_name || 'List'

  return (
    <div data-testid="mobile-list-detail" className="flex flex-col h-full bg-bg">
      <div className="px-[18px] pt-[60px] pb-3 shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-[34px] h-[34px] rounded-full bg-surface-2 text-text-muted text-xl leading-none grid place-items-center">‹</button>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold font-display text-text truncate">{listName}</h1>
          </div>
        </div>
        <SegmentedControl options={LENS} value={lens} onChange={setLens} />
      </div>
      <div className="flex-1 overflow-hidden">
        {lens === 'list'
          ? <MobileListLens listId={listId} items={items} members={members} onOpen={onOpen} />
          : <div className="h-full overflow-x-auto px-[18px] pb-[116px]"><BoardView items={items} members={members} groupMode="status" onMove={onMove} onOpen={onOpen} /></div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Branch `ListView.jsx`** to render `MobileListDetail` on mobile (keep desktop body):

```jsx
import { useIsMobile } from '../../lib/useMediaQuery.js'
import { MobileListDetail } from '../mobile/MobileListDetail.jsx'
// first line of component body:
if (useIsMobile()) return <MobileListDetail />
```

- [ ] **Step 5: Run — expect PASS.** Run `ListView` desktop test to confirm unaffected.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mobile/MobileListDetail.jsx frontend/src/features/items/ListView.jsx frontend/src/features/mobile/__tests__/MobileListDetail.test.jsx
git commit -m "feat(mobile): list detail with List/Board lens toggle (Board reuses dnd BoardView)"
```

---

## Task 11: `MobileListLens` (drag-to-reorder + persistence)

**Files:**
- Create: `frontend/src/features/mobile/MobileListLens.jsx`
- Test: `frontend/src/features/mobile/__tests__/MobileListLens.test.jsx`

**Interfaces:**
- Consumes: `useUpdateItem(listId)` (`{ id, completed }` for the checkbox; `{ id, position }` for reorder), `Chip`, `Avatar`, `statusChipColor`, store `openItem` (via `onOpen` prop).
- Produces: `MobileListLens({ listId, items, members, onOpen })` — scrollable rows (checkbox + title + chips + assignee avatar + drag handle). Drag handle (`data-reorder-handle`, `touch-action:none`) lifts the row; on release commits a new `position` between neighbors using the 1000-gap convention and calls `useUpdateItem({ id, position })`. Completion checkbox toggles `completed`.

- [ ] **Step 1: Write the failing test.** Mock `useUpdateItem`; assert rows render and that a handle drag past one row height commits a `position` update. Drive via pointer events; mock row height by stubbing the rows array length math (the implementation reads a fixed `ROW_H` constant so jsdom's 0-height is irrelevant).

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const mutate = vi.fn()
vi.mock('../../../lib/api.js', () => ({ useUpdateItem: () => ({ mutate }) }))
import { MobileListLens } from '../MobileListLens.jsx'

const items = [
  { id: 1, text: 'First', status: 'To do', completed: false, position: 1000, assignee_id: null },
  { id: 2, text: 'Second', status: 'To do', completed: false, position: 2000, assignee_id: null },
  { id: 3, text: 'Third', status: 'To do', completed: false, position: 3000, assignee_id: null },
]

describe('MobileListLens', () => {
  beforeEach(() => mutate.mockClear())
  it('renders a row per item with a drag handle', () => {
    render(<MobileListLens listId="2" items={items} members={[]} onOpen={() => {}} />)
    expect(screen.getByTestId('lens-row-1')).toBeInTheDocument()
    expect(screen.getAllByTestId(/reorder-handle-/)).toHaveLength(3)
  })
  it('toggling the checkbox updates completed', () => {
    render(<MobileListLens listId="2" items={items} members={[]} onOpen={() => {}} />)
    fireEvent.click(screen.getByTestId('lens-check-1'))
    expect(mutate).toHaveBeenCalledWith({ id: 1, completed: true })
  })
  it('dragging row 1 down past one row commits a new position', () => {
    render(<MobileListLens listId="2" items={items} members={[]} onOpen={() => {}} />)
    const handle = screen.getByTestId('reorder-handle-1')
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 70, pointerId: 1 }) // ROW_H = 56 → target index 1
    fireEvent.pointerUp(handle, { clientY: 70, pointerId: 1 })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    const arg = mutate.mock.calls.find((c) => c[0].id === 1 && 'position' in c[0])[0]
    expect(arg.position).toBeGreaterThan(1000) // moved between old #2 and #3
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `MobileListLens.jsx`.** Local ordered copy for optimistic display; `ROW_H = 56`. On reorder commit, compute target index and a new position = midpoint of the neighbors at the target slot (or `prev + 1000` at the end, or `next/2` at the start).

```jsx
import { useRef, useState, useEffect } from 'react'
import { useUpdateItem } from '../../lib/api.js'
import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { statusChipColor } from '../../lib/listColor.js'

const ROW_H = 56
const GAP = 1000

function positionForIndex(order, targetIndex, movingId) {
  const without = order.filter((it) => it.id !== movingId)
  const prev = without[targetIndex - 1]
  const next = without[targetIndex]
  if (!prev && !next) return GAP
  if (!prev) return Math.floor(next.position / 2) || 1
  if (!next) return prev.position + GAP
  const mid = Math.floor((prev.position + next.position) / 2)
  return mid === prev.position ? prev.position + 1 : mid
}

export function MobileListLens({ listId, items, members = [], onOpen }) {
  const { mutate } = useUpdateItem(listId)
  const [order, setOrder] = useState(items)
  useEffect(() => { setOrder(items) }, [items])
  const drag = useRef({ id: null, startY: 0, startIndex: 0 })

  const emailById = Object.fromEntries(members.map((m) => [m.user_id, m.email]))

  function onHandleDown(e, item, index) {
    e.stopPropagation()
    drag.current = { id: item.id, startY: e.clientY, startIndex: index, targetIndex: index }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onHandleMove(e) {
    const d = drag.current
    if (d.id == null) return
    const dy = e.clientY - d.startY
    d.targetIndex = Math.max(0, Math.min(order.length - 1, d.startIndex + Math.round(dy / ROW_H)))
  }
  function onHandleUp() {
    const d = drag.current
    if (d.id == null) return
    const { id, startIndex, targetIndex } = d
    drag.current = { id: null }
    if (targetIndex === startIndex) return
    const moving = order.find((it) => it.id === id)
    const reordered = order.filter((it) => it.id !== id)
    reordered.splice(targetIndex, 0, moving)
    setOrder(reordered)
    const position = positionForIndex(order, targetIndex, id)
    mutate({ id, position })
  }

  return (
    <div className="h-full overflow-y-auto px-[18px] pb-[116px]">
      {order.map((item, index) => (
        <div key={item.id} data-testid={`lens-row-${item.id}`} className="flex items-center gap-3 py-[13px] px-1 border-b border-border" style={{ minHeight: ROW_H }}>
          <button
            type="button"
            data-testid={`lens-check-${item.id}`}
            aria-label={item.completed ? 'Completed' : 'Mark complete'}
            onClick={() => mutate({ id: item.id, completed: !item.completed })}
            className={['w-[22px] h-[22px] rounded-full border-2 shrink-0', item.completed ? 'bg-success border-success' : 'border-border'].join(' ')}
          />
          <button type="button" onClick={() => onOpen?.(item.id)} className="min-w-0 flex-1 text-left">
            <span className={['block text-[15px] font-semibold truncate', item.completed ? 'line-through text-text-muted' : 'text-text'].join(' ')}>{item.text}</span>
            <span className="flex items-center gap-1.5 mt-1">
              {item.status && item.status !== 'To do' && <Chip color={statusChipColor(item.status)}>{item.status}</Chip>}
              {item.due_date && <Chip color="neutral">{item.due_date.slice(5)}</Chip>}
            </span>
          </button>
          {item.assignee_id != null && <Avatar name={emailById[item.assignee_id] || String(item.assignee_id)} size="sm" />}
          <span
            data-testid={`reorder-handle-${item.id}`}
            data-reorder-handle
            onPointerDown={(e) => onHandleDown(e, item, index)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            className="shrink-0 cursor-grab px-1 py-2 flex flex-col gap-1"
            style={{ touchAction: 'none' }}
            aria-label="Reorder"
          >
            <span className="block w-4 h-[2px] bg-text-muted rounded-full" />
            <span className="block w-4 h-[2px] bg-text-muted rounded-full" />
            <span className="block w-4 h-[2px] bg-text-muted rounded-full" />
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile/MobileListLens.jsx frontend/src/features/mobile/__tests__/MobileListLens.test.jsx
git commit -m "feat(mobile): drag-to-reorder list lens with position persistence"
```

---

## Task 12: `MobileItemSheet` (bottom-sheet item detail)

**Files:**
- Modify: `frontend/src/features/mobile/MobileItemSheet.jsx` (replace stub)
- Test: `frontend/src/features/mobile/__tests__/MobileItemSheet.test.jsx`

**Interfaces:**
- Consumes: store `detailItemId`/`detailContext`/`closeDetail`; `useListItems(listId)` (to find the open item), `useUpdateItem(listId)`, `useWorkspaceMembers(workspaceId)`; controls `StatusControl` (`{ value, onChange }`), `AssigneePicker` (`{ value, members, onChange }`), `DueDateField` (`{ value, onChange }`), `CommentThread` (`{ itemId, workspaceId, listId }`); `Sheet variant="bottom"`; `listColor`.
- Produces: `MobileItemSheet()` — renders nothing unless `detailItemId` set. Opens a bottom Sheet showing: title row (checkbox + item title `21px/700` display), Status chips (`StatusControl`), Assignee + Due side-by-side tiles, read-only List tile (color dot + name + project), Notes (debounced 500ms → `useUpdateItem({ id, notes })`), and `CommentThread`. Closes on scrim/Escape via `closeDetail`.

- [ ] **Step 1: Write the failing test.** Set store `detailItemId`/`detailContext`; mock hooks; assert title + status control render and the checkbox toggles completion.

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const mutate = vi.fn()
vi.mock('../../../lib/api.js', () => ({
  useListItems: () => ({ data: [{ id: 5, list_id: 2, text: 'Order cake', status: 'Doing', completed: false, assignee_id: null, due_date: '2026-07-01', notes: '', list_name: 'Catering', project_name: 'Wedding' }] }),
  useUpdateItem: () => ({ mutate }),
  useWorkspaceMembers: () => ({ data: [] }),
}))
vi.mock('../../comments/CommentThread.jsx', () => ({ CommentThread: () => <div data-testid="comment-thread" /> }))
import { useStore } from '../../../lib/store.js'
import { MobileItemSheet } from '../MobileItemSheet.jsx'

describe('MobileItemSheet', () => {
  beforeEach(() => { mutate.mockClear(); useStore.setState({ detailItemId: 5, detailContext: { listId: 2, workspaceId: 9 } }) })
  it('shows the item title, status control and comments', () => {
    render(<MobileItemSheet />)
    expect(screen.getByText('Order cake')).toBeInTheDocument()
    expect(screen.getByTestId('comment-thread')).toBeInTheDocument()
  })
  it('renders nothing when no item is open', () => {
    useStore.setState({ detailItemId: null, detailContext: null })
    const { container } = render(<MobileItemSheet />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `MobileItemSheet.jsx`** (notes debounce mirrors `ItemDetailDrawer`'s 500ms pattern with a `useRef` timeout).

```jsx
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../lib/store.js'
import { useListItems, useUpdateItem, useWorkspaceMembers } from '../../lib/api.js'
import { Sheet } from '../../ui/Sheet.jsx'
import { StatusControl } from '../items/StatusControl.jsx'
import { AssigneePicker } from '../items/AssigneePicker.jsx'
import { DueDateField } from '../items/DueDateField.jsx'
import { CommentThread } from '../comments/CommentThread.jsx'
import { listColor } from '../../lib/listColor.js'

export function MobileItemSheet() {
  const detailItemId = useStore((s) => s.detailItemId)
  const ctx = useStore((s) => s.detailContext) || {}
  const closeDetail = useStore((s) => s.closeDetail)
  const listId = ctx.listId
  const workspaceId = ctx.workspaceId

  const { data: items = [] } = useListItems(listId)
  const { mutate } = useUpdateItem(listId)
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const item = items.find((i) => String(i.id) === String(detailItemId))

  const [notes, setNotes] = useState('')
  const notesTimer = useRef(null)
  useEffect(() => { setNotes(item?.notes || '') }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!detailItemId || !item) return null

  function onNotes(v) {
    setNotes(v)
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => mutate({ id: item.id, notes: v }), 500)
  }

  return (
    <Sheet variant="bottom" open onClose={closeDetail} title={item.text}>
      <div className="px-5 pb-8 space-y-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={item.completed ? 'Completed' : 'Mark complete'}
            onClick={() => mutate({ id: item.id, completed: !item.completed })}
            className={['w-[26px] h-[26px] rounded-full border-2 shrink-0 mt-1', item.completed ? 'bg-success border-success' : 'border-border'].join(' ')}
          />
          <h2 className="text-[21px] font-bold font-display text-text">{item.text}</h2>
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <StatusControl value={item.status} onChange={(status) => mutate({ id: item.id, status })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <FieldLabel>Assignee</FieldLabel>
            <AssigneePicker value={item.assignee_id} members={members} onChange={(assignee_id) => mutate({ id: item.id, assignee_id })} />
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <FieldLabel>Due</FieldLabel>
            <DueDateField value={item.due_date} onChange={(due_date) => mutate({ id: item.id, due_date })} />
          </div>
        </div>

        <div className="rounded-xl bg-surface-2 p-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: listColor(item.list_id) }} />
          <span className="text-[14px] text-text">{item.list_name}</span>
          {item.project_name && <span className="text-[12px] text-text-muted">· {item.project_name}</span>}
        </div>

        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={3} className="w-full rounded-xl bg-surface-2 p-3 text-[14px] text-text outline-none resize-none" placeholder="Add notes…" />
        </div>

        <CommentThread itemId={item.id} workspaceId={workspaceId} listId={listId} />
      </div>
    </Sheet>
  )
}

function FieldLabel({ children }) {
  return <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted mb-1.5">{children}</div>
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile/MobileItemSheet.jsx frontend/src/features/mobile/__tests__/MobileItemSheet.test.jsx
git commit -m "feat(mobile): bottom-sheet item detail reusing status/assignee/due/comment controls"
```

---

## Task 13: `QuickAddSheet` (FAB capture)

**Files:**
- Modify: `frontend/src/features/mobile/QuickAddSheet.jsx` (replace stub)
- Test: `frontend/src/features/mobile/__tests__/QuickAddSheet.test.jsx`

**Interfaces:**
- Consumes: store `quickAddOpen`/`setQuickAddOpen`; `useMyTasks` (distinct lists for the chooser), `useCreateItem(listId)` (`{ text, status, assignee_id, due_date }`), `getUser()` (current user id for `assignee_id`), `Sheet variant="bottom"`, `Toast`, `listColor`.
- Produces: `QuickAddSheet()` — renders only when `quickAddOpen`. Title "New task", a large text input, a **When** chip row (Today/Tomorrow/This week/Someday → due offsets `0/1/3/null` days), a **List** chip row (distinct lists from `useMyTasks`, default first), and a gradient full-width "Add task" button. Submit → `useCreateItem(selectedListId).mutate({ text, status:'To do', assignee_id: currentUserId, due_date })`, show a success toast, clear, and close.

- [ ] **Step 1: Write the failing test.**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const create = vi.fn()
vi.mock('../../../lib/api.js', () => ({
  useMyTasks: () => ({ data: [{ id: 1, list_id: 2, list_name: 'Venue', completed: false }] }),
  useCreateItem: () => ({ mutate: create }),
}))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ id: 99, email: 'me@example.com' }) }))
import { useStore } from '../../../lib/store.js'
import { QuickAddSheet } from '../QuickAddSheet.jsx'

describe('QuickAddSheet', () => {
  beforeEach(() => { create.mockClear(); useStore.setState({ quickAddOpen: true }) })
  it('creates a task in the selected list and closes', () => {
    render(<QuickAddSheet />)
    fireEvent.change(screen.getByTestId('quickadd-input'), { target: { value: 'Tjjjry cake' } })
    fireEvent.click(screen.getByTestId('quickadd-submit'))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ text: 'Tjjjry cake', status: 'To do', assignee_id: 99 }))
    expect(useStore.getState().quickAddOpen).toBe(false)
  })
  it('renders nothing when closed', () => {
    useStore.setState({ quickAddOpen: false })
    const { container } = render(<QuickAddSheet />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `QuickAddSheet.jsx`.**

```jsx
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
  const { data: tasks = [] } = useMyTasks()
  const lists = useMemo(() => distinctLists(tasks), [tasks])
  const [text, setText] = useState('')
  const [when, setWhen] = useState('today')
  const [listId, setListId] = useState(lists[0]?.id)
  const user = getUser()
  const effectiveListId = listId ?? lists[0]?.id
  const { mutate: createItem } = useCreateItem(effectiveListId)

  if (!open) return null

  function submit() {
    if (!text.trim() || !effectiveListId) return
    const offset = WHEN.find((w) => w.key === when)?.offset ?? null
    createItem({ text: text.trim(), status: 'To do', assignee_id: user?.id ?? null, due_date: dueFromOffset(offset) })
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
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mobile/QuickAddSheet.jsx frontend/src/features/mobile/__tests__/QuickAddSheet.test.jsx
git commit -m "feat(mobile): quick-add FAB sheet (when + list chips, gradient CTA)"
```

---

## Task 14: `ActivityScreen` (mobile)

**Files:**
- Create: `frontend/src/features/mobile/ActivityScreen.jsx`
- Modify: `frontend/src/features/collab/ActivityFeed.jsx` (mobile branch) **or** branch at the route
- Test: `frontend/src/features/mobile/__tests__/ActivityScreen.test.jsx`

**Interfaces:**
- Consumes: `useWorkspaceActivity(workspaceId)` (`{ data: { items, unread } }`), `useMarkActivityRead(workspaceId)`, store `presence`, `Avatar`, `useParams`.
- Produces: `ActivityScreen()` — "Activity" title, a presence stack (overlapping 28px avatars `-space-x-2`, 2px ring) + "N teammates online now", then a timeline list (avatar + connector + `<b>actor</b> verb target` + relative time). Marks read on mount (guard with a ref, mirroring `ActivityFeed`).

- [ ] **Step 1: Write the failing test** (mock hooks + params + store presence). Assert title, presence count, and a timeline entry render.

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('react-router-dom', () => ({ useParams: () => ({ workspaceId: '9' }) }))
const markRead = vi.fn()
vi.mock('../../../lib/api.js', () => ({
  useWorkspaceActivity: () => ({ data: { items: [{ id: 1, actor_email: 'a@x.com', verb: 'completed', created_at: '2026-06-24T00:00:00Z' }], unread: 1 } }),
  useMarkActivityRead: () => ({ mutate: markRead }),
}))
import { useStore } from '../../../lib/store.js'
import { ActivityScreen } from '../ActivityScreen.jsx'

it('renders the activity title and a timeline entry', () => {
  useStore.setState({ presence: { 1: { userId: 1, email: 'a@x.com' } } })
  render(<ActivityScreen />)
  expect(screen.getByTestId('activity-screen')).toBeInTheDocument()
  expect(screen.getByText(/teammate/i)).toBeInTheDocument()
  expect(screen.getByText(/a@x\.com/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `ActivityScreen.jsx`.** Reuse the verb-phrase map from `ActivityFeed` (copy the small map — it is presentational copy, not logic worth sharing across a module boundary). Relative-time helper inline.

```jsx
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useWorkspaceActivity, useMarkActivityRead } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Avatar } from '../../ui/Avatar.jsx'

const VERB = { assigned: 'assigned an item', completed: 'completed an item', commented: 'commented on an item', mentioned: 'mentioned someone' }

function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function ActivityScreen() {
  const { workspaceId } = useParams()
  const { data } = useWorkspaceActivity(workspaceId)
  const { mutate: markRead } = useMarkActivityRead(workspaceId)
  const presence = useStore((s) => s.presence)
  const marked = useRef(false)
  useEffect(() => { if (!marked.current) { marked.current = true; markRead() } }, [markRead])

  const items = data?.items || []
  const online = Object.values(presence)

  return (
    <div data-testid="activity-screen" className="px-[18px] pt-[62px] pb-[116px] space-y-5 min-h-full bg-bg">
      <h1 className="text-[30px] font-bold font-display tracking-[-0.8px] text-text">Activity</h1>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {online.slice(0, 6).map((p) => (
            <span key={p.userId} className="ring-2 ring-bg rounded-full"><Avatar name={p.email} size="sm" /></span>
          ))}
        </div>
        <span className="text-[13px] text-text-muted">{online.length} teammate{online.length === 1 ? '' : 's'} online now</span>
      </div>
      <ul className="space-y-4">
        {items.map((a) => (
          <li key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Avatar name={a.actor_email} size="md" />
              <span className="flex-1 w-px bg-border mt-1" aria-hidden="true" />
            </div>
            <div className="pb-2">
              <p className="text-[14px] text-text"><b>{a.actor_email}</b> {VERB[a.verb] || a.verb}</p>
              <p className="text-[12px] text-text-muted mt-0.5">{ago(a.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Branch the activity route.** In `routes.jsx`, the activity element renders an `ActivityFeed`/`ActivityFeedRoute` wrapper. Make that wrapper branch: `if (useIsMobile()) return <ActivityScreen />` else the existing desktop `ActivityFeed`.

- [ ] **Step 5: Run — expect PASS.** Confirm desktop activity test unaffected.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mobile/ActivityScreen.jsx frontend/src/app/routes.jsx frontend/src/features/mobile/__tests__/ActivityScreen.test.jsx
git commit -m "feat(mobile): Activity screen with presence stack and timeline feed"
```

---

## Task 15: `MeScreen` (profile + settings + theme)

**Files:**
- Create: `frontend/src/features/mobile/MeScreen.jsx`
- Modify: `frontend/src/app/routes.jsx` (ensure `/me` → `MeScreen`; import it)
- Test: `frontend/src/features/mobile/__tests__/MeScreen.test.jsx`

**Interfaces:**
- Consumes: `getUser()`/`logout()` from `lib/auth.js`, `useMyTasks` (stat tiles), store `theme`/`setTheme`, `SegmentedControl`, `Avatar`, `useNavigate`, `NotificationPrefs` (open via a row → its existing sheet).
- Produces: `MeScreen()` — centered 78px avatar, name, email; two stat tiles (open tasks `primary`, done today `success`); an Appearance card with a `Light / Dark` `SegmentedControl` bound to `theme`/`setTheme`; a Preferences card (Notifications → opens `NotificationPrefs`; Live sync; Workspace; Members) as chevron rows; a full-width `danger` "Log out" button → `logout()` + redirect `/login`.

- [ ] **Step 1: Write the failing test.**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../lib/api.js', () => ({ useMyTasks: () => ({ data: [{ id: 1, completed: false, due_date: null }] }) }))
const logout = vi.fn()
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ email: 'me@example.com' }), logout }))
vi.mock('../../notifications/NotificationPrefs.jsx', () => ({ NotificationPrefs: () => <div data-testid="notif-prefs" /> }))
import { useStore } from '../../../lib/store.js'
import { MeScreen } from '../MeScreen.jsx'

describe('MeScreen', () => {
  beforeEach(() => useStore.setState({ theme: 'light' }))
  it('shows email and toggles theme via the segmented control', () => {
    render(<MeScreen />)
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(useStore.getState().theme).toBe('dark')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `MeScreen.jsx`.**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, logout } from '../../lib/auth.js'
import { useMyTasks } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { NotificationPrefs } from '../notifications/NotificationPrefs.jsx'

const THEME_OPTIONS = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]
const today = () => new Date().toISOString().slice(0, 10)

export function MeScreen() {
  const navigate = useNavigate()
  const user = getUser()
  const { data: tasks = [] } = useMyTasks()
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const [notifOpen, setNotifOpen] = useState(false)

  const open = tasks.filter((t) => !t.completed).length
  const doneToday = tasks.filter((t) => t.completed && (t.due_date || '').slice(0, 10) === today()).length
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
```

- [ ] **Step 4: Ensure `/me` route imports `MeScreen`** (replace any stub created in Task 5).

- [ ] **Step 5: Run — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mobile/MeScreen.jsx frontend/src/app/routes.jsx frontend/src/features/mobile/__tests__/MeScreen.test.jsx
git commit -m "feat(mobile): Me screen with stats, theme switch, preferences, and logout"
```

---

## Task 16: Full-suite verification + manual smoke pass

**Files:**
- Test: whole frontend suite.

- [ ] **Step 1: Run the entire frontend test suite.**

Run: `cd frontend && npm test`
Expected: all green (existing + new). Fix any regressions — desktop component tests must still pass unchanged.

- [ ] **Step 2: Lint/build smoke.**

Run: `cd frontend && npm run build`
Expected: Vite build succeeds (catches missing imports, bad token references, font resolution).

- [ ] **Step 3: Manual smoke (mobile viewport).** `cd frontend && npm run dev`, open at a ≤767px viewport (or device toolbar). Verify: tab bar (Today/Lists/Activity/Me + FAB) navigates; Today shows focus card + sections; swipe right completes, swipe left snoozes; Lists shows cards + search; opening a task opens the bottom sheet; List detail toggles List/Board; drag handle reorders; quick-add creates; Me toggles theme (persists across reload). Confirm desktop (≥768px) is visually unchanged.

- [ ] **Step 4: Commit any fixes.**

```bash
git add -A && git commit -m "test(mobile): full-suite green + build smoke for mobile redesign"
```

---

## Self-Review

**Spec coverage** (README §1–8 + tab bar + interactions + tokens):
- §1 Today → Tasks 6, 7. §2 Lists → Task 8. §3 Search → Tasks 8, 9. §4 List detail → Tasks 10, 11. §5 Item sheet → Tasks 3, 12. §6 Quick-add → Task 13. §7 Activity → Task 14. §8 Me → Task 15. Tab bar → Tasks 4, 5. Swipe → Task 7. Reorder → Task 11. Sheets → Task 3. Theme → Tasks 2, 15. Tokens/font → Task 1. Shell/responsive → Task 5. All covered.
- Net-new tokens (gradient, tints, card shadow, tabbar, scrim, radii) → Task 1. ✓
- Reorder persistence (position column already exists; `useUpdateItem` persists it) → Task 11. ✓

**Type consistency:** status strings `'To do'|'Doing'|'Done'|'Blocked'` used identically across Tasks 1, 7, 11, 12. `openItem(id, { listId, workspaceId })` signature consistent across Tasks 2, 6, 8, 10 and consumed in 12. `useUpdateItem(listId).mutate({ id, ... })` consistent. Bucket keys `overdue/today/upcoming/noDate` match `groupTasks.js`. `MobileTabBar` tab ids `today/lists/activity/me` consistent across 4 & 5.

**Known follow-ups (not blockers, out of plan scope):** grab-handle drag-down-to-dismiss on sheets (tap-scrim/Escape shipped); board lens compact-card restyle is reuse-as-is (acceptable per README "keep it; just apply compact styling" — apply minor class tweaks only if review flags); `assignee_email` on `useMyTasks` is resolved client-side via members (no backend change).
