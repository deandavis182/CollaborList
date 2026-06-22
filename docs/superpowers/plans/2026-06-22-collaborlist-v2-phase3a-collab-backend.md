# CollaborList V2 — Phase 3A: Collaboration Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Read the roadmap first: `docs/superpowers/plans/2026-06-22-collaborlist-v2-roadmap.md`, then the design spec §3/§6/§9. Steps use `- [ ]`. **Branch: `v2-phase3-collab-backend`** off `main`.

**Goal:** Build the backend for collaboration — assignments, due dates, status↔completed sync, comments + @mentions, an activity feed with a per-workspace unread watermark, a "My Tasks" query, and live presence/typing — on the schema already shipped in Phase 1, exposed as bounded `routes/` + `services/` modules with real-time events, all additive and test-covered.

**Architecture:** Approach A. Item collab fields extend the existing inline `PUT/POST /api/items` handlers additively (do **not** rewrite the cross-list-move transaction). All NEW surface (comments, activity, tasks, presence) lands as focused `routes/*.js` factories + `services/*.js` modules following the established Phase 2A pattern. A new `realtime/events.js` is the single source of truth for socket-event names; route factories receive emit helpers from `server.js`.

**Tech Stack:** Node 18, Express 4.18, PostgreSQL 15 (raw parameterized SQL via `pg`), Socket.io 4.6, JWT. Jest + Supertest (unit = mocked pool; integration = real DB).

## Global Constraints (every task inherits these)
- **Zero live-data loss / additive only.** One new migration `013` (continue `NNN_snake_case` numbering); `CREATE/ALTER … IF NOT EXISTS`, `INSERT … WHERE NOT EXISTS`, `UPDATE … WHERE … IS NULL` only. Never DROP/rewrite. Names immutable once shipped.
- **`completed` stays the source of truth** for done-state (keeps group-by-completion + existing tests green). `status` is the richer label (`To do` / `Doing` / `Done` / `Blocked`). **Write-time sync:** when `status` is written, set `completed = (status === 'Done')`; when `completed` is written without `status`, set `status = completed ? 'Done' : 'To do'`. New rows are never silently NULL (DB default `'To do'` via migration 013 + POST sets it).
- **`cross-list-move.test.js` MUST keep passing.** The PUT `/api/items/:id` cross-list transaction logic is load-bearing — extend its field-set, do not restructure it.
- **Permission model:** reading an item's comments/activity requires list **view** access; posting comments / assigning / setting status requires **edit** access (owner or `list_shares.permission='edit'`), mirroring the existing item-edit check. Workspace-scoped endpoints (activity) require `requireWorkspaceRole(pool,'member')`.
- **Notifications in Phase 3 = activity records + unread watermark only.** Actual Web Push delivery is Phase 6. Mentions/assignments create activity rows; do not add `web-push` here.
- **Commit messages: NO `Co-Authored-By` trailer.** Plain subject + body.
- **Backend test image has no volume mount** (`Dockerfile.test` does `COPY . .`). Before EVERY test run: `docker compose --profile test build backend-test`.
  - Unit: `docker compose --profile test run --rm backend-test` (mocks pg).
  - Integration: `docker compose --profile test run --rm backend-test npm run test:integration`.
  - Migration/backfill tests must run the relevant SQL **directly** (the test DB volume persists and migrations are name-gated) and pass on **two consecutive runs**.

## Carry-forwards honored here
- **#3 (status NULL handling):** migration 013 sets `list_items.status` DEFAULT `'To do'` and backfills remaining NULLs; POST/PUT always write a status. Decision recorded: **DB default + app guarantee** (belt-and-suspenders).
- Activity is written **in the same transaction as its action** (spec §6) wherever the action already uses a transaction; for single-statement actions, write the activity row immediately after in the same handler.

## New real-time events (added to `realtime/events.js`)
`comment-created`, `comment-deleted`, `activity-created`, `presence-update`, `typing`. Existing events keep their current names. Rooms: existing `list-{id}` + `workspace-{id}`.

## File Structure
- Create: `backend/realtime/events.js` — frozen object of event-name constants (FE mirror added in 3B).
- Create: `backend/realtime/presence.js` — in-memory presence map module (pure, unit-testable).
- Create: `backend/services/itemAccess.js` — `getItemAccess(pool, itemId, userId)`.
- Create: `backend/services/commentService.js`, `backend/services/activityService.js`, `backend/services/taskService.js`.
- Create: `backend/routes/comments.js`, `backend/routes/activity.js`, `backend/routes/tasks.js` (factories `(authenticateToken, sanitize, emit) => router`).
- Modify: `backend/db/migrations.js` (add `013`).
- Modify: `backend/server.js` — extend `PUT`/`POST /api/items` field-set + sync + activity; mount new routers passing an `emit` bundle; add presence/typing socket handlers in `io.on('connection')`.
- Tests: `backend/__tests__/*.test.js` (unit, mocked pool) + `backend/__tests__/*.integration.test.js` (real DB).

## Tasks (each TDD, bite-sized; expand on execution)

1. **Migration 013 + events catalog.**
   - `backend/realtime/events.js`: `module.exports = Object.freeze({ COMMENT_CREATED:'comment-created', COMMENT_DELETED:'comment-deleted', ACTIVITY_CREATED:'activity-created', PRESENCE_UPDATE:'presence-update', TYPING:'typing', ITEM_UPDATED:'item-updated', ITEM_CREATED:'item-created', ITEM_DELETED:'item-deleted' })`.
   - Migration `013_collab_defaults_and_watermark`:
     ```sql
     ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS last_seen_activity TIMESTAMP;
     ALTER TABLE list_items ALTER COLUMN status SET DEFAULT 'To do';
     UPDATE list_items SET status = CASE WHEN completed THEN 'Done' ELSE 'To do' END WHERE status IS NULL;
     ```
   - **Integration test:** run the 013 SQL directly (twice for idempotency); assert a freshly-inserted `list_items` row with no status gets `'To do'`, a NULL-status row is backfilled, and `workspace_members.last_seen_activity` exists. Verify on two consecutive runs.

2. **`services/itemAccess.js` — shared item permission helper.**
   - `async getItemAccess(pool, itemId, userId)` → `{ found, listId, isOwner, canView, canEdit }`. SQL mirrors the existing PUT handler permCheck (join `list_items`→`lists` LEFT JOIN `list_shares`); `canView = isOwner || share exists (any permission)`; `canEdit = isOwner || share.permission==='edit'`. Returns `{ found:false }` when the item doesn't exist.
   - **Unit test** (mocked pool): owner → canEdit/canView true; edit-share → both true; view-share → canView true, canEdit false; no access → canView/canEdit false; missing item → found false. Use this helper in new endpoints (Tasks 5/6); do NOT refactor the existing inline endpoints in this phase.

3. **Item collab fields + status↔completed sync.**
   - Extend `POST /api/lists/:listId/items`: accept optional `assignee_id`, `due_date`, `status`; default `status` from `completed` when omitted (`completed ? 'Done' : 'To do'`); when `status` provided, set `completed=(status==='Done')`; INSERT the new columns. Keep existing behavior otherwise.
   - Extend `PUT /api/items/:id`: add `assignee_id`, `due_date`, `status` to the destructure and the dynamic `UPDATE` field-builder (same `$n` pattern). Apply write-time sync: if `status !== undefined` → also set `completed=(status==='Done')`; else if `completed !== undefined` → also set `status = completed?'Done':'To do'`. Validate `status` is one of the four labels (400 otherwise). Validate `assignee_id` (when not null) is a member of the workspace owning the item's list's project, OR a user with access to the list (400 otherwise) — keep it simple: assignee must be a `workspace_members` row for the project's workspace; if the list has no project, allow the list owner or any `list_shares` user. The existing `item-updated` emit already fires for non-cross-list updates.
   - **Integration tests:** assign an item; set `due_date`; set `status='Done'` → `completed=true`; set `status='Doing'` → `completed=false`; set `completed=true` with no status → `status='Done'`; invalid status → 400; assignee who is not a participant → 400. **Re-run `cross-list-move.test.js` — must stay green.**

4. **`services/commentService.js`.**
   - `async list(pool, itemId)` → comments joined to `users` (`id, body, created_at, user_id, email`), oldest-first.
   - `async create(pool, { itemId, userId, body })` → inserted row joined to user.
   - `async remove(pool, commentId)`; `async getOwnerAndItem(pool, commentId)` → `{ user_id, item_id }` for delete authz.
   - `parseMentions(body)` → array of unique lowercased handles from `@token` (token = `[A-Za-z0-9._%+-]+(@[A-Za-z0-9.-]+)?`). Mentions match members by email local-part or full email (resolved in the route against the workspace member list).
   - **Unit tests** (mocked pool + pure): create/list/remove call shapes; `parseMentions` extracts, dedupes, lowercases, ignores stray `@`.

5. **`routes/comments.js` + wiring.**
   - Factory `(authenticateToken, sanitize, emit) => router` where `emit = { list:emitListUpdate, workspace:emitWorkspaceUpdate }`.
   - `GET /api/items/:id/comments` — `getItemAccess`; 404 if not found, 403 if `!canView`; return `commentService.list`.
   - `POST /api/items/:id/comments` — `getItemAccess`; 403 if `!canEdit`; sanitize `body` (reuse `sanitize`, allow longer text — see note); create; `emit.list(listId, COMMENT_CREATED, { listId, itemId, comment })`; record activity `verb:'commented'`; for each parsed mention resolved to a workspace member, record activity `verb:'mentioned'` with `meta:{ mentionedUserId }`. Return 201 comment.
   - `DELETE /api/comments/:id` — load via `getOwnerAndItem`; allow if author OR item-list owner (via `getItemAccess(...).isOwner`); `emit.list(listId, COMMENT_DELETED, { listId, itemId, commentId })`; 200.
   - Mount in `server.js`: `app.use('/api', require('./routes/comments')(authenticateToken, sanitizeInput, { list: emitListUpdate, workspace: emitWorkspaceUpdate }))`.
   - **Note on sanitize:** the existing `sanitizeInput` strips `<>"'` etc. and caps length — acceptable for markdown-light comments; do not loosen it in this phase. Record as a Minor follow-up if it harms comment UX.
   - **Integration tests:** view-share user can GET but POST→403; edit user POSTs→201 + comment row; author deletes own→200; non-author non-owner delete→403; mention of an existing member creates a `mentioned` activity row.

6. **`services/activityService.js`.**
   - `async record(db, { workspaceId, projectId=null, actorId, verb, target=null, meta={} })` — INSERT into `activity`; `db` may be a pool or a transaction client (so callers in a txn pass the client).
   - `async listForWorkspace(pool, workspaceId, { limit=50 })` → rows joined to actor `users` (`actor_email`), newest-first.
   - `async unreadCount(pool, workspaceId, userId)` → count of activity newer than that member's `last_seen_activity` (NULL watermark ⇒ all count).
   - `async markRead(pool, workspaceId, userId)` → `UPDATE workspace_members SET last_seen_activity = NOW()`.
   - Resolve `workspaceId/projectId` for an item: add `async function projectContextForList(pool, listId)` → `{ workspaceId, projectId }` (lists→projects→workspaces; NULLs when unattached). Use it when recording item/comment activity.
   - **Unit tests** (mocked pool): record/list/unreadCount/markRead query shapes; NULL watermark counts all.

7. **`routes/activity.js` + recording item events.**
   - Factory `(authenticateToken, sanitize, emit) => router`, mounted at `app.use('/api/activity', ...)`.
   - `GET /api/activity/workspace/:workspaceId` — `requireWorkspaceRole(pool,'member')`; return `{ items: listForWorkspace(...), unread: unreadCount(...) }`.
   - `POST /api/activity/workspace/:workspaceId/read` — `requireWorkspaceRole(pool,'member')`; `markRead`; 200.
   - In `PUT /api/items/:id`: after a successful non-cross-list update, when `assignee_id` changed → `record(pool,{verb:'assigned', meta:{assigneeId}})`; when it became Done → `record(pool,{verb:'completed'})`; resolve workspace/project via `projectContextForList`; `emit.workspace(workspaceId, ACTIVITY_CREATED, activityRow)`. Guard so unattached lists (no workspace) simply skip activity (no crash).
   - **Integration tests:** assigning an item creates an `assigned` activity + increments unread; `read` resets unread to 0; non-member→403 on GET.

8. **`services/taskService.js` + `routes/tasks.js` — My Tasks.**
   - `async forUser(pool, userId, { limit=200 })` → items where `assignee_id=userId` AND the user has access to the item's list (owner OR `list_shares` OR member of the list's project workspace), joined with list name + project name, ordered by `due_date NULLS LAST, created_at`.
   - Factory mounted at `app.use('/api/me', require('./routes/tasks')(authenticateToken))`; `GET /api/me/tasks` → `forUser(pool, req.user.id)`.
   - **Integration tests:** returns only my assigned items I can access; excludes items in lists I can't see; ordered by due date with NULLs last.

9. **Presence + typing (in-memory).**
   - `backend/realtime/presence.js`: a module holding `Map<userId, { userId, email, currentListId, lastSeen }>`; functions `setOnline(userId, email)`, `setCurrentList(userId, listId)`, `setOffline(userId)`, `snapshot()` → array. Ephemeral, never persisted.
   - In `server.js` `io.on('connection')`: on connect `setOnline`; `socket.on('presence-list', listId => { setCurrentList; broadcast })`; `socket.on('typing', ({listId,isTyping}) => io.to('list-'+listId).emit(TYPING, {userId, email, isTyping}))` (no persistence; throttle is the client's job); on `disconnect` `setOffline`; after online/list/offline changes, emit `PRESENCE_UPDATE` with `snapshot()` to each of the user's `workspace-{id}` rooms.
   - **Unit test** for `presence.js` (pure map behavior). Socket wiring verified by boot + a brief manual note in the report (no socket integration harness in this repo).

10. **Mount + full verification.**
    - Ensure all routers mounted in `server.js` *before* the production-security/listen block; `node --check server.js`; boot the stack.
    - Run unit (mocked) + full integration suites; confirm `cross-list-move.test.js` and all Phase 1/2A integration tests still green. Run integration twice (idempotency).

## Self-Review checklist
- Only additive migration (013); status default + watermark column; idempotent on two runs.
- `completed`↔`status` sync correct both directions; new rows never NULL.
- `cross-list-move.test.js` untouched and green; PUT field-set extended, not restructured.
- Comments/activity/tasks each have HTTP authz tests (view vs edit vs member).
- `realtime/events.js` is the only place event names are spelled; routes/services import from it.
- No `web-push` / no push delivery (Phase 6). No `Co-Authored-By`.

## Hand-off
After 3A: run the Phase 3A whole-branch final review over `v2-phase3-collab-backend`, then merge to `main`. Proceed to **Phase 3B** (`2026-06-22-collaborlist-v2-phase3b-collab-frontend.md`), which builds the item list + detail drawer, comments UI, My Tasks, activity feed, and presence on top of these APIs. Update the roadmap status line for Phase 3A.
