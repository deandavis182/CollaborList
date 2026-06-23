# CollaborList V2 — Phase 4: Views + Parity Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Read the roadmap first: `docs/superpowers/plans/2026-06-22-collaborlist-v2-roadmap.md`, then design spec §2/§5/§10. Steps `- [ ]`. **Branch: `v2-phase4-views`** off `main`.

**Goal:** Give the new shell the four views (List/Board/Calendar/Timeline) over the same items, inline tags, a live countdown to the wedding date, and per-user view preferences — then add a login screen to the new shell and perform the PARITY FLIP so the new shell becomes the default app at `/`. End-to-end Playwright-tested in the running container.

**Architecture:** Approach A + design system. Views are pure lenses over the item list: a `ViewSwitcher` (SegmentedControl) picks the lens; a per-(user,list) preference persists in localStorage. Board/Calendar/Timeline are new; List is enhanced with group-by + inline metadata. Backend gets two additive read enrichments (tags on items; a project roll-up endpoint). Auth screen ports the existing login/register/Google flow into the new shell so the flip is safe.

**Tech Stack:** React 18, Vite 5, Tailwind (tokens), react-router-dom v6 (hash router at /v2.html → browser router after flip), @tanstack/react-query v5, zustand, @dnd-kit/core+sortable+utilities (already deps), Vitest + Testing Library. Backend: Express, pg (additive only).

## Global Constraints (every task inherits)
- **Additive backend only.** No new migration needed (tags/item_tags exist). Enrich reads only. cross-list-move.test.js + all suites stay green.
- **Query keys:** existing keys unchanged; add `['projectItems', projectId]` for roll-up, `['viewPref', ...]` is localStorage (not React Query). Event names ONLY from lib/events.js.
- **ui/ primitives + design tokens; no hardcoded hex.** String()/Number() coercion for ids.
- **Reuse @dnd-kit** for Board (the project already depends on it; see the old `RealtimeApp.jsx` for usage patterns).
- **LIVE APP:** untouched UNTIL the parity-flip task (T13). Until then, new shell only at /v2.html.
- Every FE task TDD (Vitest + Testing Library), mock lib/api + lib/socket; `cd frontend && npm test` green + `cd frontend && npm run build` emits BOTH index.html + v2.html after every task. Backend tasks: `docker compose --profile test build backend-test` before tests; unit + integration green (run integration twice).
- **NO `Co-Authored-By` trailer.** Report files under `.superpowers/sdd/` are gitignored — do NOT git-commit them.

## Tasks

### Backend (additive)
1. **Items carry tags + project roll-up endpoint.**
   - Enrich `GET /api/lists/:listId/items` (inline in server.js) so each row includes `tags: [{id,name,color}]` (LEFT JOIN item_tags→tags, aggregated via a subquery or json_agg). Additive; existing fields intact.
   - Add `GET /api/projects/:id/items` to `routes/projects.js` (real router, requireWorkspaceRole 'member'): all items across the project's lists, each with `list_id`, `list_name`, and `tags`. Order by due_date NULLS LAST, then position.
   - Tests: extend `hub.integration.test.js` or add `project-items.integration.test.js` (REAL projects router via supertest) — items returned across lists, with tags + list_name. For the inline list-items tag enrichment, extend the item-collab replica test to assert the `tags` shape (note: replica pattern per the 3A carry-forward).

### Frontend — tags + view infrastructure
2. **Tag hooks + TagPicker.** api.js: `useAddItemTag(listId)` (POST /items/:id/tags {tag_id}, invalidate ['items',listId]), `useRemoveItemTag(listId)` (DELETE /items/:id/tags/:tagId, invalidate). Component `features/tags/TagPicker.jsx` ({ item, workspaceId, listId }) — shows the item's tag Chips (color), a "+ tag" menu populated from `useTags(workspaceId)` to add, and × to remove. Render tag Chips read-only inline on ItemRow; full picker in ItemDetailDrawer. Tests.
3. **View preference hook + ViewSwitcher.** `lib/useViewPref.js`: `useViewPref(scopeKey)` → `{ view, setView, groupBy, setGroupBy }` persisted in localStorage under `collaborlist:viewpref:<scopeKey>` (scopeKey = `list:<id>` or `project:<id>`), defaults view='list', groupBy='none'. `features/views/ViewSwitcher.jsx` — SegmentedControl over `[{value:'list',label:'List'},{value:'board',label:'Board'},{value:'calendar',label:'Calendar'},{value:'timeline',label:'Timeline'}]` bound to the pref. Tests (persistence, switching).
4. **ViewContainer.** `features/views/ViewContainer.jsx` ({ items, listId, workspaceId, projectId?, scopeKey, weddingDate? }) — renders ViewSwitcher + the selected view component (List/Board/Calendar/Timeline), passing items + handlers (useUpdateItem). Single integration point used by both the list route and the project roll-up. Tests (renders the right view per pref).

### Frontend — the four views
5. **ListView (enhanced).** `features/views/ListViewLens.jsx` — the current ListItems rendering PLUS group-by (none/completion/status/assignee/tag): a group-by control (small SegmentedControl or select bound to pref.groupBy), grouped sections with headers + counts, collapsible. Inline assignee avatar/due chip/tag chips on each row (reuse ItemRow). Keep add-item. Tests (grouping by each dimension; ungrouped).
6. **BoardView.** `features/views/BoardView.jsx` — Kanban columns. Default group = status (To do/Doing/Done/Blocked); a toggle to group by assignee. Cards = items (text, assignee avatar, due chip, tags). Drag a card to another column via @dnd-kit (DndContext + sortable or droppable columns) → on drop, `useUpdateItem.mutate({id, status})` (or `{assignee_id}` in assignee mode). Empty columns droppable. Tests: renders columns by status; simulating a drop calls useUpdateItem with the target status (use @dnd-kit testing approach or directly invoke the onDragEnd handler with a synthetic event — assert the mutate payload).
7. **CalendarView + countdown.** `features/views/CalendarView.jsx` — a month grid (current month, prev/next nav) placing items on their `due_date` day cells (show item text, click → openDetail). `features/views/Countdown.jsx` — when a `weddingDate` is provided, a prominent live countdown ("N days until the big day", computed from today). Tests: items land on correct day cells; month nav; countdown computes days from a fixed `now`; no countdown when no weddingDate.
8. **TimelineView.** `features/views/TimelineView.jsx` — a horizontal/vertical timeline of dated items (and the wedding date as a milestone marker) ordered by due_date, grouped by week, from today to the furthest due date (or the wedding date). Undated items listed in a "No date" rail. Click → openDetail. Tests (ordering, week grouping, wedding milestone marker, undated rail).

### Frontend — wiring views into routes
9. **List route uses ViewContainer.** Update `features/items/ListView.jsx` to render `<ViewContainer items={useListItems(listId)} listId workspaceId scopeKey={`list:${listId}`} />` (+ keep ItemDetailDrawer mounted). The List lens keeps the add-item box. Tests.
10. **Project roll-up view.** Update `features/projects/ProjectView.jsx` (or a sibling) so the project route ALSO offers a roll-up: a view switcher over ALL project items via `useProjectItems(projectId)` (new hook → GET /api/projects/:id/items) using `scopeKey={`project:${projectId}`}` and `weddingDate={project.wedding_date}`. Keep the existing list-management cards (lists list) accessible (e.g. a "Lists" tab vs a "Board/Calendar/..." roll-up, or show roll-up below the lists). Calendar/Timeline here use the project's wedding_date for the countdown/milestone. Tests.

### Frontend — auth + parity flip
11. **Auth in the new shell.** `features/auth/` — `LoginView.jsx` (email/password login + register toggle, calls POST /api/auth/login / /register via apiClient, stores token+user in localStorage, then navigates to `/`), optional Google button if `GOOGLE_CLIENT_ID` present (mirror RealtimeApp's flow; if non-trivial, ship email/password and leave a Google stub). `lib/auth.js` helpers: `getToken()`, `getUser()`, `logout()`. A `RequireAuth` wrapper that redirects to `/login` when no token. Add `/login` route (outside AppLayout). Wire a "Log out" + current-user indicator into the AppLayout header (the `U` avatar). Tests (login posts + stores + redirects; RequireAuth redirects when no token; logout clears).
12. **Guard the app routes.** Wrap the AppLayout route tree in `RequireAuth` so unauthenticated users go to `/login`. Ensure the socket/providers still work post-login (token read at mount; on login, the socket should connect — handle by reading token in providers, and reconnect after login, e.g. via a full navigation or a token-aware effect). Tests.
13. **PARITY FLIP + build.** Point `frontend/src/main.jsx` at the new app (import Providers + RouterApp from app, switch router from hash to BROWSER router in `routes.jsx` `createAppRouter` since it now serves from `/`), and update `frontend/index.html` to load `main.jsx` (the new shell) — making the new shell the default at `/`. Keep `RealtimeApp.jsx` in the repo (not deleted) and keep `v2.html`/`main-v2.jsx` working too. `nginx.conf` already SPA-falls-back to index.html — verify deep links work with the browser router. `npm run build` emits index.html (new shell) + v2.html. Tests: route tree still green with browser router (tests use MemoryRouter so unaffected); add a smoke test that `main.jsx` mounts the new app.

### Verification (Playwright, real container)
14. **End-to-end live test.** Rebuild + restart containers (`docker compose up -d --build frontend backend`). Using Playwright MCP against `http://localhost:3000/`: register/login a fresh user; create a workspace→project→list; add items; assign/due/status/tag an item in the detail drawer; switch List→Board (drag a card to change status)→Calendar (see it on its due day + countdown)→Timeline; check My Tasks + Activity update; verify the live app loads at `/` (parity flip). Capture screenshots. Fix any runtime bugs found (dispatch fixers). Document results in the report.

## Self-Review checklist
- All four views render the same items; ViewSwitcher persists per (user,list/project) via localStorage.
- Board drag updates status via PUT; Calendar/Timeline use real due_dates + project wedding_date countdown.
- Tags display inline + editable; backend item-tag endpoints reused.
- Auth screen works; RequireAuth guards; parity flip makes `/` the new shell with a browser router; deep links work; live app untouched until T13.
- Playwright E2E passes against the running container; zero console errors on the happy path.
- Additive backend; cross-list-move + all suites green. No Co-Authored-By.

## Hand-off
After Phase 4: whole-branch final review over `v2-phase4-views`, merge to main, push, rebuild container, update roadmap (Phase 4 done + parity flip DONE) + memory. Then Phase 5 (Structured Fields). The parity flip is local/main only — the user deploys to production manually.
