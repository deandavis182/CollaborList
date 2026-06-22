# CollaborList V2 — Phase 3B: Collaboration Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Read the roadmap first: `docs/superpowers/plans/2026-06-22-collaborlist-v2-roadmap.md`, then the design spec §3/§5/§6/§10, then the Phase 3A backend plan for the exact API contracts. Steps use `- [ ]`. **Branch: `v2-phase3-collab-frontend`** off `main` (after 3A is merged).

**Goal:** On the new `/v2.html` shell, make items first-class: render a list's items, open an item detail drawer to assign people / set due date+status / read+post comments with @mentions, plus a "My Tasks" landing view, a workspace activity feed with an unread dot, and live presence/typing — all consuming the Phase 3A APIs and real-time events. This is the first phase where the new shell can edit items (it does NOT yet replace the live app; parity flip stays deferred to post-Phase-4).

**Architecture:** Approach A + design system. New React Query hooks in `lib/api.js`; socket→cache patching extended in `lib/socket.js`; presence into the existing zustand `store.js`; feature UI under `features/items`, `features/comments`, `features/collab`, `features/tasks`; rendered through the 2B `AppLayout`/router and 2B `ui/` primitives. All token-styled, no hardcoded colors.

**Tech Stack:** React 18, Vite 5, Tailwind (tokens), react-router-dom v6 (hash router at `/v2.html`), @tanstack/react-query v5, zustand, socket.io-client; Vitest + Testing Library (jsdom). Mock `lib/api` and `lib/socket` in component tests — no network.

## Global Constraints (every task inherits these)
- **Live app untouched:** never modify `frontend/src/main.jsx`, `frontend/index.html`, or `RealtimeApp.jsx`. New shell only, at `/v2.html`. Parity flip stays deferred (post-Phase-4).
- Every task TDD (Vitest + Testing Library); mock api/socket hooks so tests never hit the network. `cd frontend && npm test` green + `npm run build` succeeds after every task (build must still emit both `index.html` and `v2.html`).
- Token-styled via `ui/` primitives (`Button`, `Card`, `Chip`, `Avatar`, `Sheet`, `Field`, `SegmentedControl`, `Toast`); no hardcoded hex.
- **React Query keys (consistent with prior phases):** `['items', listId]`, `['comments', itemId]`, `['myTasks']`, `['activity', workspaceId]`. Existing keys (`['workspaces']`, `['projects', wsId]`, `['projectLists', projectId]`, `['members', wsId]`, `['tags', wsId]`) unchanged.
- **Socket event names mirror the backend** — create `frontend/src/lib/events.js` mirroring `backend/realtime/events.js`; never type event-name string literals in components.
- **Permissions in UI:** disable comment composer / assignment / status controls when the user lacks edit access (the API enforces it; the UI should reflect it). Derive editability from the list/workspace role already available, or treat 403 from a mutation as read-only and surface a Toast.
- **Commit messages: NO `Co-Authored-By` trailer.**

## File Structure
- Create: `frontend/src/lib/events.js` (mirror of backend events catalog).
- Modify: `frontend/src/lib/api.js` — add item/comment/task/activity hooks.
- Modify: `frontend/src/lib/socket.js` — handle `item-*`, `comment-*`, `activity-created`, `presence-update`, `typing`.
- Modify: `frontend/src/lib/store.js` — presence already present; add `typing` map + setters if needed.
- Create: `frontend/src/features/items/ListItems.jsx` (renders items of a list), `features/items/ItemRow.jsx`, `features/items/ItemDetailDrawer.jsx`, `features/items/AssigneePicker.jsx`, `features/items/StatusControl.jsx`, `features/items/DueDateField.jsx`.
- Create: `frontend/src/features/comments/CommentThread.jsx`, `features/comments/CommentComposer.jsx` (with `@mention` autocomplete).
- Create: `frontend/src/features/tasks/MyTasksView.jsx`.
- Create: `frontend/src/features/collab/ActivityFeed.jsx`, `features/collab/PresenceBar.jsx`, `features/collab/TypingIndicator.jsx`.
- Modify: `frontend/src/features/projects/ProjectView.jsx` (lists become navigable into items) and `frontend/src/app/routes.jsx` (+ list route, My Tasks landing, Activity route) and `app/AppLayout.jsx` / `Sidebar.jsx` / `BottomTabBar.jsx` (nav entries + presence + unread dot).

## Tasks (each TDD, bite-sized; expand on execution)

1. **`lib/events.js` + item hooks.** Mirror the backend event constants. Add `useListItems(listId)` (`GET /api/lists/:listId/items`, key `['items',listId]`, enabled when listId), `useCreateItem(listId)` (optimistic temp-id append), `useUpdateItem(listId)` (mutationFn `{ id, ...fields }` → `PUT /api/items/:id`; optimistic patch of the `['items',listId]` cache; supports `assignee_id/due_date/status/completed/text/notes`), `useDeleteItem(listId)`. Tests with mocked apiClient.
2. **Comment + task + activity hooks.** `useItemComments(itemId)` (`GET /api/items/:id/comments`, key `['comments',itemId]`), `useCreateComment(itemId)` (`POST`; invalidate `['comments',itemId]`), `useDeleteComment(itemId)`. `useMyTasks()` (`GET /api/me/tasks`, key `['myTasks']`). `useWorkspaceActivity(workspaceId)` (`GET /api/activity/workspace/:id`, key `['activity',wsId]`, returns `{items,unread}`), `useMarkActivityRead(workspaceId)` (`POST .../read`; invalidate `['activity',wsId]`). Tests.
3. **socket.js cache patching.** Extend `registerSocketHandlers`: `item-created/updated/deleted` → patch/invalidate `['items', payload.listId]`; `comment-created/deleted` → invalidate `['comments', payload.itemId]`; `activity-created` → invalidate `['activity', payload.workspace_id]` (and `['myTasks']` when an assignment); `presence-update` → `useStore.getState().setPresence(map)`; `typing` → update a typing map in the store. Import names from `lib/events.js`. Tests assert the right cache ops fire per event (mock queryClient + store).
4. **ListItems + ItemRow.** `ListItems({ listId })` renders items via `useListItems`: completion checkbox (`useUpdateItem` `{completed}`), text, assignee `Avatar` chip, due-date chip, status `Chip`; clicking a row calls `store.openDetail(item.id)`; an add-item input uses `useCreateItem`. `ItemRow` is the presentational row. Respect nesting (indent by `parent_id` depth as the old app does, 24px/level) read-only for now. Tests: renders items, toggling checkbox calls update, click opens detail.
5. **ItemDetailDrawer + field controls.** `ItemDetailDrawer` opens when `store.detailItemId` is set (uses `ui/Sheet` `variant="drawer"`); loads the item from the `['items',listId]` cache (pass listId via props/route). Sub-controls: `AssigneePicker` (lists `useWorkspaceMembers(workspaceId)`, sets `assignee_id`), `StatusControl` (`SegmentedControl` over the four labels → `useUpdateItem {status}`), `DueDateField` (`ui/Field` date input → `{due_date}`), notes textarea (debounced like the old app). Tests: changing status/assignee/due calls `useUpdateItem` with the right payload; drawer closes on Escape/close.
6. **CommentThread + CommentComposer.** `CommentThread({ itemId })` lists comments (author email + relative time) via `useItemComments`; delete button on own/owned comments. `CommentComposer` posts via `useCreateComment`; `@` opens an autocomplete menu populated from `useWorkspaceMembers` (filter by typed text, insert `@email-local`); disabled when read-only. Render inside `ItemDetailDrawer`. Tests: renders comments, posting calls hook, `@` shows member suggestions, selecting inserts the handle.
7. **MyTasksView + landing.** `MyTasksView` shows `useMyTasks()` grouped/sorted by due date (Overdue / Today / Upcoming / No date), each row links to its item (open list + detail). Route `/my-tasks` and make it the default landing (index route renders MyTasks when a workspace is selected; keep the existing welcome when none). Sidebar/BottomTabBar entry. Tests: groups by due bucket, empty state, nav entry present.
8. **ActivityFeed + unread dot.** `ActivityFeed({ workspaceId })` lists `useWorkspaceActivity` items (actor + verb + target, relative time); on mount/visible calls `useMarkActivityRead`. Route `/w/:workspaceId/activity`; nav entry (mobile Activity tab + desktop sidebar) shows an unread dot when `unread>0`. Tests: renders entries, marks read on view, unread dot reflects count.
9. **Presence + typing UI.** `PresenceBar` renders an `Avatar` stack from `store.presence` in `AppLayout` header. `TypingIndicator` shows "X is typing…" from the store's typing map inside `CommentThread`. Wire the client to emit `presence-list` on entering a list and throttled `typing` from the composer. Tests: presence avatars render from store; typing indicator shows/hides; composer emits throttled typing (fake timers).
10. **Wire routes + nav + final build.** Connect ProjectView list cards → list route (`/w/:wsId/p/:projectId/l/:listId`) rendering `ListItems` + mounting `ItemDetailDrawer`; ensure My Tasks landing + Activity routes reachable from `Sidebar` and `BottomTabBar`; ProjectView note about "use the old app" removed where items now work. `npm test` + `npm run build` (both entries emit). Tests for the route tree (MemoryRouter) covering list + my-tasks + activity.

## Self-Review checklist
- Live app untouched (`main.jsx`/`index.html`/`RealtimeApp.jsx`); new shell only at `/v2.html`; parity flip NOT performed.
- All 3A endpoints consumed via typed hooks with the documented keys; event names only from `lib/events.js`.
- Optimistic item updates with rollback; socket events patch the cache live (no manual refetch in components).
- Read-only users can view but controls are disabled / 403 surfaces a Toast.
- Every task TDD, no network in tests; build emits both HTML entries.

## Hand-off
After 3B: run the Phase 3 whole-branch final review over `v2-phase3-collab-frontend`, then merge to `main`. The new shell can now create/edit/assign/comment on items. **Parity flip still deferred** until Phase 4 (Views) ports the enhanced List/Board/Calendar/Timeline; update the roadmap accordingly and proceed to Phase 4.
