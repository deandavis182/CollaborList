# CollaborList V2 — Master Roadmap (Continuity Bible)

> **Purpose:** Single source of truth for the V2 overhaul so the work can be resumed
> *exactly as designed* after any context reset. If you are a fresh session: read this
> file, then the design spec, then the current phase's plan, then check git log + the
> SDD ledger to see what's actually done. Do not redesign — execute the outline.

- **Design spec (authoritative requirements):** `docs/superpowers/specs/2026-06-22-collaborlist-v2-design.md`
- **Approach:** A (evolve the existing React/Vite + Express + Postgres + Socket.io + Docker/Traefik stack in place; no rewrite) + a real design system (from Approach C).
- **Driving use case:** wedding planning with the user's wife (wedding ~4 months from 2026-06-22, i.e. ~Oct 2026); broader goal is a central, deeply collaborative project hub (work + household + wedding).
- **Hard constraint:** ZERO live-data loss on every deploy (additive, idempotent, transactioned migrations).

## How to resume after a context reset
1. Read this roadmap + the design spec.
2. `git log --oneline -20` on `main` to see merged phases.
3. Read the SDD progress ledger if mid-phase: `.superpowers/sdd/progress.md` (git-ignored scratch).
4. Find the first phase below not marked ✅ DONE. If its plan file exists, execute it via
   `superpowers:subagent-driven-development`. If not, write it via `superpowers:writing-plans`
   following the phase outline here, then execute.
5. Apply the Working Conventions (below) without exception.

## Working Conventions (apply to every phase)
- **Branch per phase** off `main` (e.g. `v2-phase2-hub-backend`); merge to `main` when the
  phase's final whole-branch review passes; delete the branch after merge.
- **TDD**, bite-sized tasks, frequent commits. Subagent-driven execution: implementer + task
  review (spec + quality) per task, broad whole-branch review at the end.
- **Commit messages: NO `Co-Authored-By` trailer** (user rule). Plain subject + body only.
- **Backend test image has no volume mount** (`Dockerfile.test` does `COPY . .`). You MUST
  `docker compose --profile test build backend-test` before each test run to pick up code changes.
  - Unit suite: `docker compose --profile test run --rm backend-test` (mocks pg; must stay green).
  - Integration suite (real DB): `docker compose --profile test run --rm backend-test npm run test:integration`.
  - Migrations are name-gated + the test DB volume persists: tests that need a backfill to run
    against freshly-seeded data must execute the migration SQL directly (see Phase 1 Task 5), not
    rely on `runMigrations`. Verify migration/backfill tests pass on TWO consecutive runs.
- **Migrations** live in `backend/db/migrations.js` as `{name, sql}` entries; continue the
  `NNN_snake_case` numbering (next is `013`). Additive only — never DROP/rewrite. Names are immutable once shipped.
- **Keep the old app working:** `frontend/src/RealtimeApp.jsx` stays the live entry until the new
  shell reaches feature parity; flip `frontend/src/main.jsx` only when parity is verified.
- **Pre-deploy:** `pg_dump` snapshot (documented in `DEPLOYMENT.md` → "V2 Migration Safety").

## Architecture target (where every phase is heading)
- **Backend** (`backend/`): thin `server.js`; `db/` (pool, migrations); `routes/` (one per resource);
  `services/` (SQL + business logic, unit-testable); `realtime/` (io, presence, events catalog);
  `jobs/` (reminders); `middleware/` (auth, permissions). `security.js` kept.
- **Frontend** (`frontend/src/`): `app/` (shell, routes), `features/` (auth, workspaces, projects,
  lists, items, comments, collab, fields, notifications), `views/` (List/Board/Calendar/Timeline),
  `lib/` (api = axios+React Query, socket = events→cache patches, store = Zustand for ephemeral/UI),
  `ui/` (design tokens + primitives).
- **Data model:** Workspaces → Projects → Lists → Items, plus tags, typed custom fields, comments,
  activity, push subscriptions. (All tables already exist as of Phase 1.)

---

## Phase status & outline

> Each phase yields working, tested software on its own. Some phases are split into multiple
> plan files (the executable units). "Plan" column: file under `docs/superpowers/plans/`.

### ✅ Phase 1 — Data Foundation — DONE (merged to main, 2026-06-22)
- **Plan:** `2026-06-22-collaborlist-v2-phase1-foundation.md`
- **Delivered:** additive V2 schema migrations `003–012` (workspaces, workspace_members, projects,
  tags, item_tags, field_defs, item_fields, comments, activity, push_subscriptions,
  notification_prefs; `lists.project_id`; `list_items.assignee_id/due_date/status/reminder_sent`);
  zero-loss backfill (`012`); extraction of `db/pool.js` + `db/migrations.js`; real-DB integration
  test suite. Tests: 10/10 unit + 4/4 integration. Final review: ready-to-merge, no Critical/Important.
- **Note:** the spec's §11 Phase 1 also listed "FE shell + routing + design tokens" — that part was
  intentionally deferred to the Phase 2 frontend plan (2B) to keep the data plan focused.

### ✅ Phase 2 — Hub Structure — DONE (merged to main, 2026-06-22; origin 50b97f1)
Spec §2, §6, §10. Delivered in three plan files (all complete):
- **2A — Hub backend APIs** — ✅ DONE. **Plan:** `2026-06-22-collaborlist-v2-phase2-hub-backend.md`. (8 tasks; 19/19 integration + 10/10 unit; merged to main first as a checkpoint.)
  - Workspaces CRUD + membership; Projects CRUD (incl. `wedding_date`, color, archive, position);
    Tags CRUD + item tagging; registration creates a default Personal workspace + General project +
    owner membership for NEW users; `lists` gains project assignment + workspace-scoped fetch;
    socket `workspace-{id}` rooms; begin the `routes/` + `services/` + `middleware/permissions.js`
    restructure (extract list/item logic as you touch it). Workspace membership is the new sharing
    path; per-list `list_shares` remains valid and untouched.
- **2B — Frontend shell + design system** — ✅ DONE. **Plan:** `2026-06-22-collaborlist-v2-phase2-frontend-shell.md`.
  - React Router; `app/` shell (responsive); `ui/` design tokens (warm palette, light/dark) + primitives
    (Button, Card, Chip, Avatar, Sheet, Field, SegmentedControl, Toast); React Query + Zustand + socket
    wiring in `lib/`; Vitest+Testing-Library infra. Checkpoint-reviewed. New shell mounts at a SEPARATE
    entry (`main-v2.jsx`); live `main.jsx`/`RealtimeApp.jsx` untouched.
- **2C — Hub UI** — ✅ DONE. **Plan:** `2026-06-22-collaborlist-v2-phase2c-hub-ui.md`.
  - Workspace switcher, projects tree, ProjectView (lists under projects, read-only for now), project
    settings (color/event-date/archive/delete), tag manager, member/invite manager. Consumes 2A APIs +
    2B shell. 334 frontend tests; final-reviewed (fixed a wedding_date '' bug + id-coercion bug).
  - **PARITY FLIP DEFERRED (revised):** the new shell has NO item editing yet (Phase 3 collab + Phase 4
    views), so flipping `main.jsx` now would ship an app that can't edit items. The new hub is previewable
    at **`/v2.html`** (separate Vite entry) alongside the live app. **Do the parity flip AFTER Phase 4**,
    once list/item management is ported into the new shell.

### ⬜ Phase 3 — Collaboration Core — PLANNED (two plan files; split backend/frontend like Phase 2)
Spec §3/§6. Assignments (assignee chip, filter); **My Tasks** smart-view; due dates;
comments + @mentions (autocomplete from members, mention → activity); activity feed (per-project +
global, unread watermark); presence (in-memory map, header avatars, typing dots);
**write-time `status`↔`completed` sync** (closes Phase 1 carry-forward #3 via migration 013: status
DEFAULT 'To do' + watermark column). New socket events: `comment-created/deleted`, `presence-update`,
`typing`, `activity-created` (catalogued in new `backend/realtime/events.js` + FE `lib/events.js`).
Permission: read comments/activity = list view; post/assign/status = list edit; activity = ws member.
**Notifications in Phase 3 = activity rows + unread dot only; Web Push delivery is Phase 6.**
- **3A — Collaboration backend** — ✅ DONE (merged to main 2026-06-22, origin `078420d`). **Plan:** `2026-06-22-collaborlist-v2-phase3a-collab-backend.md`
  (10 tasks; migration 013 [status DEFAULT 'To do' + `workspace_members.last_seen_activity`], `realtime/events.js`,
  `itemAccess`/`commentService`/`activityService`[+`itemActivityEvents`]/`taskService`, `routes/comments|activity|tasks`,
  item collab fields [assignee_id/due_date/status] + write-time status↔completed sync [status wins], `realtime/presence.js`
  + socket presence/typing. 73 unit + 79 integration ×2; final review ready-to-merge, no Critical/Important).
  **NEW CARRY-FORWARD:** item endpoints remain inline in `server.js`, so `item-collab.integration.test.js` +
  `cross-list-move.test.js` use handler REPLICAS (don't exercise real server) and the PUT activity-wiring is only
  unit-covered via `itemActivityEvents` + boot. Extract `routes/items.js` + `services/itemService.js` in a future task
  (spec §9) to make them testable against real code. Minor follow-ups: malformed `due_date` → 500 not 400 (add 400 guard
  in the items extraction); comment sanitize caps 1000 chars/strips quotes (acceptable); self-assign records own activity (cosmetic).
- **3B — Collaboration frontend** — ✅ DONE (merged to main 2026-06-22, origin `b84c2e2`). **Plan:** `2026-06-22-collaborlist-v2-phase3b-collab-frontend.md`
  (10 tasks; item list + detail drawer [assignee/due/status/notes], comments + @mention autocomplete,
  My Tasks landing, activity feed + unread dot, presence/typing, list route + nav wiring. 585 tests; final
  review ready-to-merge). New shell can create/edit/assign/comment on items at `/v2.html`; live app unchanged.
- **3.5 — Usability pass** — ✅ DONE (merged with 3B, origin `b84c2e2`). Found during user testing of `/v2.html`:
  the new shell had NO way to create a list (so you couldn't reach the add-task box) and Workspaces vs Projects
  were visually indistinguishable. Added: `useCreateList/useRenameList/useDeleteList` hooks + ProjectView list
  management (touch-accessible controls — wife is mobile-primary) + socket `projectLists` invalidation; and a
  nested sidebar tree **Workspace ▸ Projects ▸ (active project's) Lists** (`ProjectListTree`) so the hierarchy is
  legible and the path to tasks is obvious. 632 tests. The full create-task loop now works end-to-end in the shell.
  **Parity flip STILL deferred to post-Phase-4** (new shell lacks the 4 views + drag/drop).

### ✅ Phase 4 — Views + PARITY FLIP — DONE (merged to main 2026-06-23, origin `956d068`)
**Plan:** `2026-06-22-collaborlist-v2-phase4-views.md` (14 tasks + 3 E2E fixes). Delivered: backend items carry
`tags[]` + `GET /api/projects/:id/items` roll-up; tag hooks + TagPicker; `useViewPref` (localStorage) + ViewSwitcher
+ ViewContainer; 4 view lenses — **List** (group-by none/completion/status/assignee/tag) → **Board** (@dnd-kit drag→status/assignee,
pure `resolveBoardMove`) → **Calendar** (month grid + live **wedding countdown**) → **Timeline** (week buckets + wedding milestone);
ListView + ProjectView roll-up ("Lists | All items") wired to ViewContainer; **auth in the new shell** (`lib/auth`, LoginView,
RequireAuth, /login); **PARITY FLIP** — `main.jsx` now mounts the new shell, `createBrowserRouter`, single `index.html`,
`v2.html`/`main-v2.jsx` deleted, `RealtimeApp.jsx` kept for rollback. 934 frontend tests; final review ready-to-merge.
**LIVE PLAYWRIGHT E2E validated the full flow** and caught + fixed 2 bugs: (1) CRITICAL — new-shell apiClient never sent
`X-CSRF-Token` so ALL mutations 403'd → fixed (interceptor); (2) pervasive date off-by-one (`new Date("YYYY-MM-DD")` UTC) →
fixed via shared `lib/dates.js` (`parseLocalDay/formatDay/daysUntil`) swept across all date displays.
**The new shell IS the app at `/` now (parity flip done).**
- **PRE-DEPLOY (production) action items:** (a) Google OAuth is omitted from LoginView (TODO) — if prod `GOOGLE_CLIENT_ID` is
  set, `/auth/register` is disabled (google-only) and there's no Google button → port Google before deploying, or confirm
  email/password-only is acceptable. (b) Take the documented `pg_dump` snapshot before deploying (zero-loss rule).
- **Carry-forwards:** extract `routes/items.js`+`services/itemService.js` (still inline; replica-tested); socket has no
  `items-refresh` handler (add when cross-list drag lands); consolidate the tag hex→Chip-color map (now duplicated 4×);
  auto-select the sole workspace for new users (minor UX); delete dead `ListItems.jsx`.

### ✅ Phase 5 — Structured Fields — DONE (merged to main 2026-06-23, merge commit `939c33d`; HEAD `3c0e104`)
Spec §5. **Plan:** `2026-06-23-collaborlist-v2-phase5-fields.md`. `field_defs` per list + `item_fields` values
(number/text/date/status/person); footer roll-ups (Σ/budget total-paid-remaining; guest invited-confirmed);
two starter presets ("Budget tracker", "Guest list"); typed inputs in detail drawer + inline read-only cells
on List rows. Socket event `field-updated`. No new migration (schema from mig 007 — additive only).
6 tasks, each task-reviewed; whole-branch review: Ready to merge, no Critical/Important. FE 1064 + BE 74 unit /
109 integration green. Live Playwright E2E confirmed budget ($8000/$5000/$3000) + guest (Invited 7/Confirmed 4).
Minor follow-ups (non-blocking): dead `budget.unit` in rollups.js; items-enrichment integ tests assert the SQL
not the HTTP endpoint. No formulas/relations/per-field perms (out of scope).

### ⬜ Phase 6 — PWA + Notifications
Spec §7. **Plan:** TBW. Vite PWA plugin (service worker + manifest + install; offline shell);
Web Push via `web-push` + VAPID env keys; `push_subscriptions` flow; deep-link from notification to
item; in-process **reminder engine** (`jobs/reminders.js`, ~15-min interval, `reminder_sent` guard);
`notification_prefs` (categories + mute-project + quiet hours). iOS: web push requires installed PWA
(16.4+) — onboarding must make install explicit. No email/digest.

### ⬜ Phase 7 — Cut-line Extras (optional, last)
**Plan:** TBW. File/photo attachments (needs storage infra) and automations/recurring tasks (rules
engine). Sequenced last so they're the natural cut if time runs short before the wedding. Kept in
scope by the user (not deferred), but lowest priority.

---

## Carry-forwards (must be honored in the noted phase)
From the Phase 1 final review and spec self-review:
1. **(Phase 2A)** Scope the migration-012 step-4 `lists`→`projects` UPDATE pattern to the *Personal*
   workspace (`AND w.name='Personal'`) — relevant once multi-workspace ownership exists; for any NEW
   backfill/linking logic, link by the specific intended workspace, not "any workspace the user owns."
2. **(Phase 2A)** New-user registration MUST create Personal workspace + General project + owner
   membership (migration 012 only backfilled pre-existing users).
3. **(Phase 3)** Decide `list_items.status` NULL handling (DB default or app guarantee) when the
   write-time `status`↔`completed` sync lands, so new rows are never silently NULL.
4. **(Phase 2/CI)** Use a separate DB name for the integration suite in CI; note in `DEPLOYMENT.md`
   that `test:integration` must never target production.
5. **(Phase 2A docs)** Update design spec §4 step 4 wording: `list_shares` is PRESERVED (not converted
   to workspace membership) so the spec matches shipped behavior.

## Deferred / explicit non-goals (do not build without a new decision)
Native mobile app; public sharing / templates marketplace; comment reactions/emoji; custom savable
filter-views; board WIP limits; formula fields; cross-list relations/lookups; per-field permissions;
email/digest notifications.
