# CollaborList V2 — Design Spec

- **Date:** 2026-06-22
- **Status:** Approved (design); pending implementation plan
- **Author:** Dean + Claude (brainstorming session)

## 1. Context & Goal

CollaborList started as a personal work-item tracker, grew into shared
household-chore lists with the user's wife, and is now being asked to hold
"a lot of different things and projects." The driving near-term use case is
**planning the user's wedding (~4 months out) collaboratively with his wife**,
but the real need that surfaced during brainstorming is broader: a **central,
deeply collaborative project hub** for work, household, and the wedding — all
in one place.

This is explicitly a *personal/shared* hub, not a product to sell. The
"saturated project-tracker market" is irrelevant: the advantage here is being
opinionated and shaped to exactly how Dean and his wife work, with
collaboration and the wedding as first-class concerns.

**Primary users:** Dean (desktop-primary) and his wife (mobile/PWA-primary).
The design must be excellent on both.

### Success criteria
- Dean's wife reaches for it on her phone daily without friction (installed PWA + push).
- "Who is doing what / by when" is always obvious (assignments + due dates + My Tasks).
- It feels *alive* — you can see the other person is there and what changed.
- Wedding budget and guest headcount are trackable without a spreadsheet.
- **Zero live-data loss on deploy.**
- The codebase is maintainable by Claude going forward (small, well-bounded modules).

## 2. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Organizing structure | **Workspaces → Projects → Lists → Items**, plus cross-cutting **tags** |
| Views | **List, Board (Kanban), Calendar+countdown, Timeline/milestones** — all four, switchable per list/project |
| Platform | **Installable PWA + Web Push** (wife-primary) **and** first-class desktop layout (Dean-primary) |
| Collaboration | **Assignments, comments + @mentions, due dates + reminders, activity feed + presence** — all in scope |
| Structured data | **Lightweight typed custom fields** (number/text/date/status/person) with list-footer roll-ups |
| Architecture | **Approach A** (evolve in place / disciplined refactor) **+ Approach C's design-system discipline** |
| Hard constraint | **Zero data loss on deploy** |

### Non-goals (explicitly deferred)
- Native iOS/Android app (PWA covers mobile).
- Public sharing / templates marketplace.
- Reactions/emoji on comments.
- Custom savable filter-views; board WIP limits.
- Formula fields, cross-list relations/lookups, per-field permissions.
- Email / digest notifications (push + in-app only).

### In scope but sequenced LAST (natural cut line if the wedding crunch hits)
- **File/photo attachments** (needs file-storage infra).
- **Automations / recurring tasks** (needs a rules engine).

## 3. Architecture Approach

**Approach A — evolve in place.** Keep the proven stack and deployment:
React 18 + Vite, Express, PostgreSQL 15, Socket.io, JWT/bcrypt auth, Docker +
Traefik. Preserve working subsystems (auth, real-time, drag-and-drop, deploy).
Restructure the two monoliths (`RealtimeApp.jsx`, `server.js`) into focused,
independently-testable modules with clear interfaces — both for maintainability
and so implementation parallelizes cleanly across subagents.

**Borrowed from Approach C:** invest in a real **design system** (tokens +
primitives) so the UI has a distinctive, intentional identity rather than
templated defaults. The `frontend-design` skill informs visual direction during
implementation.

Rejected: greenfield rewrite (Approach B) — throws away working
auth/real-time/deploy, high risk against the deadline.

## 4. Data Model & Zero-Loss Migration

The existing migration mechanism (`backend/server.js`: a `{name, sql}` array,
each applied in a transaction, tracked in a `migrations` table, idempotent via
`IF NOT EXISTS`) is reused as-is. Every V2 schema change is **additive and
backfilling** — no drops, no destructive rewrites.

### New tables
```
workspaces        — id, name, owner_id→users, created_at
workspace_members — workspace_id, user_id, role (owner|admin|member), UNIQUE(ws,user)
projects          — id, workspace_id→workspaces, name, color, wedding_date (nullable),
                    archived, position
tags              — id, workspace_id, name, color
item_tags         — item_id→list_items, tag_id→tags   (many-to-many)
item_fields       — id, item_id→list_items, key, type (number|text|date|status|person),
                    value (jsonb)
field_defs        — id, list_id→lists, key, type, label, config (jsonb)   (per-list field schema)
comments          — id, item_id→list_items, user_id→users, body, created_at
activity          — id, workspace_id, project_id, actor_id→users, verb, target, meta (jsonb),
                    created_at
push_subscriptions— id, user_id→users, endpoint, keys (jsonb)
notification_prefs— user_id→users, prefs (jsonb)   (or columns; jsonb chosen for flexibility)
```

### Evolved existing tables (additive only)
```
lists       + project_id→projects (nullable, then backfilled)
list_items  + assignee_id→users, + due_date, + status, + reminder_sent
            (keeps text, notes, parent_id, position, completed)
users       (unchanged; prefs live in notification_prefs)
```

### `completed` vs `status`
`completed` stays the source of truth for the done-state (keeps existing
group-by-completion and tests working). `status` is a richer label
(To do / Doing / Done / Blocked) that the Board groups by; saving `status`
syncs `completed = (status === 'Done')`.

### Migration sequence (each a transactioned step)
1. Create all new tables.
2. Backfill: for every existing user → create a default "Personal" workspace + owner membership.
3. For each existing list → create/assign a default "General" project in its owner's workspace; set `lists.project_id`.
4. Convert each `list_shares` row → equivalent `workspace_members` / project access. **Keep `list_shares` intact** until the new path is verified.
5. Add new `list_items` columns; backfill `status` from `completed`.

### Zero-loss guarantee
- Every step is `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `INSERT`; nothing dropped or overwritten.
- Each migration runs in a transaction that rolls back on failure; the server still boots on the old schema if a migration fails.
- The app reads "list with no project" gracefully, so a half-applied migration degrades safely.
- Belt-and-suspenders: `pg_dump` snapshot immediately before deploy for rollback.

## 5. Navigation & Views

### Shell (one responsive layout)
- **Desktop:** left sidebar (workspace switcher → projects tree → lists), main pane, right detail drawer for the selected item. Keyboard-driven (`/` search, `c` create, `j/k` navigate).
- **PWA/mobile:** sidebar → bottom tab bar (Home · Search · + · Activity · Me); project opens lists full-screen; item detail is a full-screen sheet.

### Routing (React Router)
`/w/:workspace/p/:project/l/:list?view=board` — real, linkable URLs; `?view=` selects the lens.

### The four views (lenses over the same items, segmented-control switch)
| View | Best at | Reuses |
|---|---|---|
| **List** (default) | Fast capture, nesting, group-by (completion/assignee/tag) | Existing list + @dnd-kit |
| **Board** | Who's doing what — columns by `status` (or assignee), drag cards | Existing @dnd-kit |
| **Calendar** | Dated items on a month grid + live **countdown** to project `wedding_date` | New |
| **Timeline** | Milestones across weeks to the big day | New |

### Key intuition decisions
- Views default per-list, but a **project roll-up** can show all items across its lists in any view (e.g. "Wedding → Calendar" = every dated task from Vendors/Guests/Budget). This roll-up is what makes it a hub.
- Persistent **"My Tasks"** smart-view: `assignee = me` across all workspaces, sorted by due date — the default landing view.
- View + group-by remembered per user per list (localStorage + user-prefs), so Dean and his wife can prefer different lenses on the same list.

## 6. Collaboration Layer

Rides existing Socket.io rooms (`list-{id}`) plus a new `workspace-{id}` scope.

1. **Assignments** — item → workspace member; avatar chip; drives My Tasks, board group-by-assignee, and the assignment notification. Carried on the existing `item-updated` payload (`assignee_id`).
2. **Comments + @mentions** — threaded comments in the detail drawer/sheet, markdown-light. `@name` autocompletes from members; backend parses mentions → targeted notification + activity. New events: `comment-created` / `comment-deleted`. Unread badge per item.
3. **Presence** — on connect, join workspace presence; in-memory map `{userId, currentList, lastSeen}` (same simplicity tradeoff as in-memory rate limiting). UI: header avatar stack, soft "editing…" indicator, typing dot in threads. Events: `presence-update`, `typing` (throttled). Ephemeral, never persisted.
4. **Activity feed** — `activity` table records verbs (created/completed/assigned/commented/moved/due-changed), scoped to workspace+project. Surfaces: per-project activity tab + global mobile Activity tab with a per-user `last_seen_activity` watermark (unread dot). Written in the same transaction as its action; emitted as `activity-created`.

### Permission model (evolved, not replaced)
Current owner/edit/view → **workspace roles** (owner/admin/member) + per-project access.
"Only owners move items out" → "only members with access to both source and target lists can cross-move."
Comments/assignments require ≥ member; view-only can read comments but not post.

## 7. Notifications & PWA

### PWA shell
- Vite PWA plugin → service worker + web app manifest (icons, theme, standalone). "Add to Home Screen" gives a real app icon.
- Offline shell: loads last-cached lists on flaky signal; writes queue and flush on reconnect (optimistic temp-IDs reconcile on socket return).
- Desktop install prompt available too; desktop fully functional as a normal tab regardless.

### Push (Web Push / VAPID)
- New dependency `web-push` + VAPID keypair in env (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`). No third-party service, no cost.
- Flow: after login, request permission once → store subscription in `push_subscriptions` → backend pushes through it → service worker shows OS notification → tap deep-links to the item.
- **iOS constraint:** Safari delivers web push only to a home-screen-installed PWA (iOS 16.4+). Onboarding makes the install step explicit and friendly for the wife's iPhone.

### Notification triggers (each respects per-user prefs)
| Trigger | Recipient |
|---|---|
| Assigned an item | assignee |
| @mentioned in a comment | mentioned user |
| Comment on an item you're assigned/watching | watchers |
| Due date approaching | assignee (reminder engine) |

### Reminder engine
In-process interval job (~every 15 min) queries items whose `due_date` crosses a threshold (due today / overdue / due in 24h) with `reminder_sent` not set; sends push and marks `reminder_sent`. No separate cron/queue — matches single-instance deploy. **Revisit if scaling horizontally.**

### Preferences
`notification_prefs` (jsonb): per-category toggles + mute-project + quiet hours. Sensible defaults (assignments + mentions on; comment firehose off).

## 8. Structured Fields

One flexible mechanism for budget, headcount, and similar — no spreadsheet engine.

- A list defines a few **field definitions** (`field_defs`); each item stores values in `item_fields` (jsonb).
- Types (intentionally small): **number** (money/counts, optional `$`/unit), **status** (labeled chip; also what Board groups by), **date** (secondary date), **person** (member), **text** (short freeform).
- **Footer roll-ups** over a number field:
  - Budget list: items have `cost` (number) + `status` (Estimated/Booked/Paid) → footer Σ total, Σ paid, remaining.
  - Guest list: items have `rsvp` (status: Invited/Yes/No/Maybe) + `party_size` (number) → footer total invited / confirmed headcount (Σ party_size where rsvp = Yes).
- **Two starter presets** ("Budget tracker", "Guest list") pre-create the right fields — zero config for the couple.
- Rendered inline in List (compact columns), as card metadata in Board, and in the item detail drawer.

## 9. Backend Restructure

Same stack and deployment; split monolith into bounded modules.
```
backend/
  server.js              # thin: boot, middleware wiring, start
  db/ pool.js  migrations.js
  routes/ auth.js workspaces.js projects.js lists.js items.js
          comments.js fields.js tags.js activity.js push.js
  services/ workspaceService.js itemService.js commentService.js activityService.js ...
  realtime/ io.js  presence.js  events.js     # events.js = canonical socket-event catalog
  jobs/ reminders.js
  middleware/ auth.js  permissions.js
  security.js            # kept as-is
```
Routes parse → call service → emit event → respond. Services hold parameterized
SQL + transactions (cross-list-move CTE → `itemService`). `events.js` is the single
source of truth for socket events so FE/BE never drift.

### Real-time events
Existing: `list-created/updated/deleted`, `item-created/updated/deleted`,
`items-refresh`, `list-shared`, `share-removed`.
New: `comment-created/deleted`, `presence-update`, `typing`, `activity-created`,
`field-updated`, `workspace-updated`, `member-added/removed`.
Rooms: existing `list-{id}` + new `workspace-{id}`.

### Testing
Existing Jest + mocked-pool pattern carries over; each service is now unit-testable
directly. `cross-list-move.test.js` keeps passing (SQL moves intact into `itemService`).

## 10. Frontend Restructure + Design System

```
frontend/src/
  main.jsx                 # router + providers (React Query, socket, auth, theme)
  app/                     # AppLayout, Sidebar, BottomTabBar, DetailDrawer, routes
  features/ auth/ workspaces/ projects/ lists/ items/ comments/
            collab/ (presence, activity, mentions)  fields/  notifications/
  views/ ListView BoardView CalendarView TimelineView
  lib/ api.js (axios + React Query hooks)  socket.js (events → cache patches)  store.js (Zustand: UI/ephemeral)
  ui/                      # design system: tokens + primitives
  components/              # keep Logo, PrivacyPolicy, TermsOfService
```

- **State:** React Query owns server data with optimistic mutations (existing temp-ID rollback → `onMutate`/`onError`). Socket events patch the React Query cache directly (live, no refetch). Zustand holds only ephemeral UI/presence. Eliminates the prop-drilling that forced the monolith.
- **Design system (`ui/`):** primitives (`Button`, `Card`, `Chip`, `Avatar`, `Sheet/Drawer`, `Field`, `SegmentedControl`, `Toast`) on Tailwind with design tokens (deliberate palette, type scale, spacing, radius, motion) + light/dark. `frontend-design` skill informs visual direction during implementation.
- **Migration safety:** `RealtimeApp.jsx` stays untouched in the repo until the new shell reaches feature parity behind the same auth; `main.jsx` flips to the new app only when parity is verified — no broken intermediate.

## 11. Phasing / Decomposition (for parallel implementation)

Ordered so the app is wife-usable as early as possible, with the heaviest/optional
pieces last. Module boundaries above are the parallelization seams.

1. **Foundation:** additive migrations + backfill; backend restructure scaffolding; FE shell + routing + design tokens. (Gate: existing tests still green, data intact.)
2. **Hub structure:** workspaces/projects CRUD + membership; sidebar nav; lists attached to projects; tags.
3. **Collaboration core:** assignments, due dates, My Tasks; comments + @mentions; activity feed; presence.
4. **Views:** List (enhanced) → Board → Calendar+countdown → Timeline.
5. **Structured fields:** field defs + item fields + footer roll-ups + Budget/Guest presets.
6. **PWA + notifications:** service worker/manifest/install; Web Push + subscriptions; reminder engine; prefs.
7. **Cut-line extras (last):** file/photo attachments; automations/recurring tasks.

## 12. Risks & Open Items
- In-memory presence + in-process reminder job assume single-instance deploy (documented tradeoff; revisit before horizontal scaling).
- iOS web-push requires installed PWA — onboarding must make this clear.
- Frontend parity-flip must be verified carefully to honor the no-broken-intermediate promise.
- Attachments (storage infra) and automations (rules engine) are the scope risks; sequenced last as the deliberate cut line.

## 13. Maintainability Note
The whole restructure exists so future maintenance (by Claude) operates on small,
single-purpose modules with clear interfaces and direct unit tests — not a
1,800-line monolith. File growth past a focused responsibility is the signal to split again.
