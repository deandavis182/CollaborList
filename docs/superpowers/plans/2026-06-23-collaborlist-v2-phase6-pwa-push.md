# Phase 6 — PWA + Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CollaborList an installable PWA that delivers Web Push notifications (assignments, @mentions, comments-to-watchers, and due-date reminders), each respecting per-user preferences.

**Architecture:** Additive only — the schema (`push_subscriptions`, `notification_prefs`, `list_items.reminder_sent`) already exists from migrations 010/011, so there is NO new migration. Backend gains a `pushService` (thin `web-push` wrapper, no-ops gracefully when VAPID env keys are absent), a `notificationService` (policy layer that consults `notification_prefs` before sending), a `routes/push.js`, best-effort trigger calls at the existing assignment/comment sites, and an in-process `jobs/reminders.js` interval. Frontend gains `vite-plugin-pwa` (manifest + service worker via `injectManifest` so we own a custom SW with `push`/`notificationclick` handlers), an explicit opt-in subscription flow (NOT an auto-prompt — iOS requires home-screen install first), a notification-prefs sheet, and friendly install/enable onboarding.

**Tech Stack:** Backend: `web-push` (new). Frontend: `vite-plugin-pwa` + `workbox` (new), existing @tanstack/react-query v5, zustand, React Router v6, Tailwind tokens. Tests: backend Jest + mocked `pg` pool + mocked `web-push`; frontend Vitest + Testing Library with mocked `navigator.serviceWorker` / `Notification` / `PushManager`.

## Global Constraints

- **Branch:** `v2-phase6-pwa-push` (off `main`). Do NOT switch/create other branches mid-task.
- **ADDITIVE only, zero live-data loss.** No migration in this phase. No destructive SQL.
- **The LIVE APP is the new shell at `/`** (`frontend/src/main.jsx`, browser router). Do not touch `RealtimeApp.jsx`.
- **Socket/event names** come only from `backend/realtime/events.js` (BE) and `frontend/src/lib/events.js` (FE). No string literals. (Phase 6 adds no new socket events — push is out-of-band.)
- **ui/ primitives + design tokens only — NO hardcoded hex.** Dates via `frontend/src/lib/dates.js` (`parseLocalDay`/`formatDay`/`daysUntil`), never `new Date("YYYY-MM-DD")`.
- **CSRF:** authenticated non-GET requests must carry `X-CSRF-Token` (the `apiClient` interceptor already adds it — do not regress).
- **`web-push` env keys:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` URL). When any are missing, `pushService` must NOT throw at boot or per-send — it logs once and no-ops. This keeps dev/test/CI green without keys.
- **Best-effort triggers:** every notification send is wrapped so it can never fail or delay the originating request/response. Always `try/catch` with `console.error('... (non-fatal):', e)`.
- **NO Co-Authored-By trailer** in any commit. `.superpowers/` reports are gitignored — never git-commit them.
- **Backend tests run IN the container** (host has no `node_modules`): `docker compose --profile test build backend-test` then `docker compose --profile test run --rm backend-test` (unit) / `... run --rm backend-test npm run test:integration` (real DB). Build the image before each backend test run (image bakes code via `COPY . .`).
- **Notification preference defaults** (verbatim): assignments **on**, mentions **on**, comment-firehose **off**, due reminders **on**. Plus optional `muteProjects: number[]` and `quietHours: { start: number, end: number } | null` (local 0–23 hours; inclusive-start, exclusive-end; wraps midnight when start > end).
- **iOS constraint:** web push is delivered only to a home-screen-installed PWA (iOS 16.4+). Onboarding must make the install step explicit; never auto-fire the permission prompt.

---

## Out of scope (explicit, YAGNI for the wedding timeline)
- **Offline write-queue / flush-on-reconnect** (spec §7 "writes queue and flush on reconnect"). The SW precaches the app shell (read-side offline), but a full offline mutation queue is substantial and risky; the existing optimistic-update + socket-reconnect path already covers transient drops. Defer to a later phase if the wife reports needing it. The precache shell from Task 7 is the only offline behavior delivered here.
- **Per-project mute UI** beyond the data layer — `muteProjects` is honored by `notificationService` and storable via the prefs API, but the in-UI control lives on Project settings as a follow-up (noted in Task 10).

## File Structure

**Backend (new):**
- `backend/services/pushService.js` — `web-push` wrapper: VAPID init, `isEnabled()`, `saveSubscription`, `deleteSubscription`, `listForUser`, `sendToUser` (prunes dead subscriptions on 404/410).
- `backend/services/notificationService.js` — policy layer: prefs read + defaults, `isAllowed(prefs, category, projectId, now)`, `notifyAssignment`, `notifyMention`, `notifyComment`, `notifyDueReminder`. Builds deep-link path + payload, calls `pushService.sendToUser`.
- `backend/services/prefsService.js` — `getPrefs(pool, userId)` (returns merged defaults), `setPrefs(pool, userId, partial)` (UPSERT, validates shape).
- `backend/routes/push.js` — factory `(authenticateToken) => router` mounted at `/api`: GET `/push/vapid-public-key`, POST `/push/subscribe`, POST `/push/unsubscribe`, GET `/notification-prefs`, PUT `/notification-prefs`.
- `backend/jobs/reminders.js` — `findDueItems(pool, now)`, `runReminderSweep(pool, now)`, `startReminderJob(pool, { intervalMs })` (boot-guarded).
- Tests: `backend/__tests__/pushService.test.js`, `notificationService.test.js`, `prefsService.test.js`, `reminders.test.js`, `push.integration.test.js`.

**Backend (modified):**
- `backend/server.js` — mount `routes/push.js`; add `reminder_sent = FALSE` reset when `due_date` changes; call `notificationService.notifyAssignment` at the item-update activity site; start the reminder job at boot.
- `backend/routes/comments.js` — call `notificationService.notifyMention` (per resolved mention) and `notifyComment` (watchers).
- `backend/package.json` — add `web-push`.

**Frontend (new):**
- `frontend/public/manifest.webmanifest` is generated by the plugin; icons under `frontend/public/icons/`.
- `frontend/src/sw.js` — custom service worker (Workbox `injectManifest`): precache + `push` + `notificationclick` handlers. Handler bodies delegate to pure helpers.
- `frontend/src/lib/swPush.js` — pure helpers `buildNotification(data)` and `notificationTargetUrl(data)` (unit-testable; imported by `sw.js`).
- `frontend/src/lib/push.js` — `registerServiceWorker()`, `getPermission()`, `subscribeToPush(vapidPublicKey)`, `unsubscribeFromPush()`, `urlBase64ToUint8Array(base64)`.
- `frontend/src/lib/api.js` (existing file, ADD hooks) — `useVapidKey`, `usePushSubscribe`, `usePushUnsubscribe`, `useNotificationPrefs`, `useUpdateNotificationPrefs`.
- `frontend/src/features/notifications/EnableNotifications.jsx` — opt-in button + status + iOS install hint.
- `frontend/src/features/notifications/NotificationPrefs.jsx` — settings sheet (category toggles, mute-project, quiet hours).
- `frontend/src/features/notifications/InstallHint.jsx` — "Add to Home Screen" hint (iOS-aware; uses `beforeinstallprompt` on Android/desktop).
- Tests under `frontend/src/lib/__tests__/` and `frontend/src/features/notifications/__tests__/`.

**Frontend (modified):**
- `frontend/vite.config.js` — add `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.js', ... })`.
- `frontend/package.json` — add `vite-plugin-pwa`, `workbox-precaching`, `workbox-window`.
- `frontend/src/main.jsx` — register the service worker on boot (via `lib/push.registerServiceWorker`).
- A settings entry point (the existing top-bar/account menu) — add an "Notifications" affordance that opens `NotificationPrefs` and shows `EnableNotifications`. (Implementer locates the existing menu; see Task 10.)

---

## Interfaces (shared signatures used across tasks)

```js
// pushService.js
isEnabled() // → boolean (VAPID keys present + web-push configured)
async saveSubscription(pool, userId, subscription) // subscription = {endpoint, keys:{p256dh,auth}} → row
async deleteSubscription(pool, endpoint) // → void
async listForUser(pool, userId) // → [{id, endpoint, keys}]
async sendToUser(pool, userId, payload) // payload = {title, body, url, tag?} → {sent, pruned}

// prefsService.js
const DEFAULT_PREFS = { assignments:true, mentions:true, comments:false, reminders:true, muteProjects:[], quietHours:null }
async getPrefs(pool, userId)       // → merged-with-defaults object
async setPrefs(pool, userId, partial) // → merged saved object

// notificationService.js  (every notify* takes workspaceId too — used to build the deep link)
isAllowed(prefs, category, projectId, now) // category ∈ 'assignments'|'mentions'|'comments'|'reminders'; → boolean
async notifyAssignment(pool, { assigneeId, actorId, item, projectId, listId, workspaceId })
async notifyMention(pool, { mentionedUserId, actorId, item, projectId, listId, workspaceId, commentId })
async notifyComment(pool, { watcherIds, actorId, item, projectId, listId, workspaceId, commentId })
async notifyDueReminder(pool, { assigneeId, item, projectId, listId, workspaceId, kind }) // kind ∈ 'today'|'overdue'|'soon'

// reminders.js
async findDueItems(pool, now)      // → [{id, text, due_date, assignee_id, list_id, project_id, workspace_id, kind}]
async runReminderSweep(pool, now)  // → {scanned, sent} ; marks reminder_sent = TRUE per item notified
startReminderJob(pool, { intervalMs }) // → { stop() } ; no-op + warn when pushService.isEnabled() is false

// frontend lib/push.js
urlBase64ToUint8Array(base64) // → Uint8Array
async registerServiceWorker() // → ServiceWorkerRegistration | null
async subscribeToPush(vapidPublicKey) // → PushSubscription JSON | null
async unsubscribeFromPush() // → boolean

// frontend lib/swPush.js
notificationTargetUrl(data) // data = {url} → string (defaults to '/')
buildNotification(data) // → { title, options:{ body, data:{url}, tag, icon, badge } }
```

**Deep-link path convention:** notifications link to the item's list with the item id as a query param: `/w/{workspaceId}/p/{projectId}/l/{listId}?item={itemId}`. When project context is unknown, fall back to `/`. (The shell already opens items via the detail drawer keyed by id; deep-link handling beyond navigating to the list URL is out of scope — landing on the list is sufficient for Phase 6.)

---

### Task 1: `pushService` — web-push wrapper with graceful no-op + subscription pruning

**Files:**
- Create: `backend/services/pushService.js`
- Create: `backend/__tests__/pushService.test.js`
- Modify: `backend/package.json` (add `"web-push": "^3.6.7"` to dependencies)

**Interfaces:**
- Consumes: `db/pool` is passed in by callers (never required at module top, matching `commentService`/`fieldService` which receive `pool` as the first arg).
- Produces: `isEnabled`, `saveSubscription`, `deleteSubscription`, `listForUser`, `sendToUser` (signatures above).

- [ ] **Step 1: Add the dependency**

In `backend/package.json` dependencies add `"web-push": "^3.6.7"`. Rebuild the backend test image so it is installed:
```bash
docker compose --profile test build backend-test
```

- [ ] **Step 2: Write the failing test**

`backend/__tests__/pushService.test.js`:
```js
'use strict';
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));
const webpush = require('web-push');

describe('pushService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => { process.env = OLD_ENV; });

  function load() { return require('../services/pushService'); }

  test('isEnabled is false when VAPID keys are absent and setVapidDetails is not called', () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const svc = load();
    expect(svc.isEnabled()).toBe(false);
    expect(webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  test('isEnabled is true and configures web-push when keys present', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:a@b.com';
    const svc = load();
    expect(svc.isEnabled()).toBe(true);
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:a@b.com', 'pub', 'priv');
  });

  test('sendToUser no-ops when disabled', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const svc = load();
    const pool = { query: jest.fn() };
    const res = await svc.sendToUser(pool, 1, { title: 't', body: 'b', url: '/' });
    expect(res).toEqual({ sent: 0, pruned: 0 });
    expect(pool.query).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  test('sendToUser sends to each subscription and prunes 410/404', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:a@b.com';
    const svc = load();
    const pool = { query: jest.fn() };
    // listForUser query
    pool.query.mockResolvedValueOnce({ rows: [
      { id: 1, endpoint: 'e1', keys: { p256dh: 'x', auth: 'y' } },
      { id: 2, endpoint: 'e2', keys: { p256dh: 'x', auth: 'y' } },
    ]});
    webpush.sendNotification
      .mockResolvedValueOnce({})                       // e1 ok
      .mockRejectedValueOnce({ statusCode: 410 });     // e2 gone
    // deleteSubscription query for e2
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await svc.sendToUser(pool, 7, { title: 't', body: 'b', url: '/x' });

    expect(res).toEqual({ sent: 1, pruned: 1 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    // pruned the gone endpoint
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM push_subscriptions WHERE endpoint = $1', ['e2']
    );
  });

  test('saveSubscription upserts on endpoint conflict', async () => {
    const svc = load();
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 9 }] }) };
    await svc.saveSubscription(pool, 3, { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO push_subscriptions/);
    expect(sql).toMatch(/ON CONFLICT \(endpoint\) DO UPDATE/);
    expect(params).toEqual([3, 'e', { p256dh: 'p', auth: 'a' }]);
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest pushService
```
Expected: FAIL ("Cannot find module '../services/pushService'").

- [ ] **Step 4: Implement `backend/services/pushService.js`**

```js
'use strict';
const webpush = require('web-push');

const PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@collaborlist.com';

let enabled = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    enabled = true;
  } catch (e) {
    console.error('pushService: failed to configure VAPID, push disabled:', e.message);
    enabled = false;
  }
} else {
  console.warn('pushService: VAPID keys absent — push notifications disabled (no-op).');
}

function isEnabled() { return enabled; }
function publicKey() { return PUBLIC || null; }

async function saveSubscription(pool, userId, subscription) {
  const { endpoint, keys } = subscription;
  const result = await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys
     RETURNING id`,
    [userId, endpoint, keys]
  );
  return result.rows[0];
}

async function deleteSubscription(pool, endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

async function listForUser(pool, userId) {
  const result = await pool.query(
    'SELECT id, endpoint, keys FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

async function sendToUser(pool, userId, payload) {
  if (!enabled) return { sent: 0, pruned: 0 };
  const subs = await listForUser(pool, userId);
  let sent = 0, pruned = 0;
  const body = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body
      );
      sent++;
    } catch (err) {
      if (err && (err.statusCode === 410 || err.statusCode === 404)) {
        await deleteSubscription(pool, sub.endpoint);
        pruned++;
      } else {
        console.error('pushService.sendToUser send error (non-fatal):', err && err.statusCode, err && err.message);
      }
    }
  }
  return { sent, pruned };
}

module.exports = { isEnabled, publicKey, saveSubscription, deleteSubscription, listForUser, sendToUser };
```

- [ ] **Step 5: Run the test, expect pass**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest pushService
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/services/pushService.js backend/__tests__/pushService.test.js backend/package.json backend/package-lock.json
git commit -m "feat(6.T1): pushService web-push wrapper with VAPID no-op fallback + subscription pruning"
```

---

### Task 2: `prefsService` — notification preferences with defaults + validation

**Files:**
- Create: `backend/services/prefsService.js`
- Create: `backend/__tests__/prefsService.test.js`

**Interfaces:**
- Produces: `DEFAULT_PREFS`, `getPrefs(pool, userId)`, `setPrefs(pool, userId, partial)`.

- [ ] **Step 1: Write the failing test**

`backend/__tests__/prefsService.test.js`:
```js
'use strict';
const svc = require('../services/prefsService');

describe('prefsService', () => {
  test('DEFAULT_PREFS matches the spec defaults', () => {
    expect(svc.DEFAULT_PREFS).toEqual({
      assignments: true, mentions: true, comments: false, reminders: true,
      muteProjects: [], quietHours: null,
    });
  });

  test('getPrefs merges stored prefs over defaults', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ prefs: { comments: true, muteProjects: [5] } }] }) };
    const out = await svc.getPrefs(pool, 1);
    expect(out).toEqual({
      assignments: true, mentions: true, comments: true, reminders: true,
      muteProjects: [5], quietHours: null,
    });
  });

  test('getPrefs returns defaults when no row exists', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    const out = await svc.getPrefs(pool, 1);
    expect(out).toEqual(svc.DEFAULT_PREFS);
  });

  test('setPrefs upserts merged prefs and ignores unknown keys', async () => {
    const pool = { query: jest.fn() };
    // getPrefs read inside setPrefs
    pool.query.mockResolvedValueOnce({ rows: [{ prefs: {} }] });
    // upsert
    pool.query.mockResolvedValueOnce({ rows: [{ prefs: { assignments: false } }] });
    const out = await svc.setPrefs(pool, 2, { assignments: false, bogus: 'x' });
    expect(out.assignments).toBe(false);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/INSERT INTO notification_prefs/);
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/);
    expect(params[0]).toBe(2);
    expect(params[1]).not.toHaveProperty('bogus');
    expect(params[1].assignments).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest prefsService
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/services/prefsService.js`**

```js
'use strict';

const DEFAULT_PREFS = {
  assignments: true,
  mentions: true,
  comments: false,
  reminders: true,
  muteProjects: [],
  quietHours: null,
};

const BOOL_KEYS = ['assignments', 'mentions', 'comments', 'reminders'];

function sanitize(partial) {
  const out = {};
  for (const k of BOOL_KEYS) {
    if (typeof partial[k] === 'boolean') out[k] = partial[k];
  }
  if (Array.isArray(partial.muteProjects)) {
    out.muteProjects = partial.muteProjects.map(Number).filter((n) => Number.isInteger(n));
  }
  if (partial.quietHours === null) {
    out.quietHours = null;
  } else if (partial.quietHours && typeof partial.quietHours === 'object') {
    const { start, end } = partial.quietHours;
    if (Number.isInteger(start) && Number.isInteger(end)) {
      out.quietHours = { start, end };
    }
  }
  return out;
}

async function getPrefs(pool, userId) {
  const result = await pool.query('SELECT prefs FROM notification_prefs WHERE user_id = $1', [userId]);
  const stored = result.rows[0] ? result.rows[0].prefs : {};
  return { ...DEFAULT_PREFS, ...stored };
}

async function setPrefs(pool, userId, partial) {
  const current = await getPrefs(pool, userId);
  const merged = { ...current, ...sanitize(partial) };
  await pool.query(
    `INSERT INTO notification_prefs (user_id, prefs)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs`,
    [userId, merged]
  );
  return merged;
}

module.exports = { DEFAULT_PREFS, getPrefs, setPrefs };
```

- [ ] **Step 4: Run, expect pass**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest prefsService
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/prefsService.js backend/__tests__/prefsService.test.js
git commit -m "feat(6.T2): prefsService notification-prefs read/write with defaults + validation"
```

---

### Task 3: `notificationService` — prefs-aware policy layer

**Files:**
- Create: `backend/services/notificationService.js`
- Create: `backend/__tests__/notificationService.test.js`

**Interfaces:**
- Consumes: `prefsService.getPrefs`, `pushService.sendToUser`.
- Produces: `isAllowed(prefs, category, projectId, now)`, `notifyAssignment`, `notifyMention`, `notifyComment`, `notifyDueReminder`, and helper `deepLink({ workspaceId, projectId, listId, itemId })`.

- [ ] **Step 1: Write the failing test**

`backend/__tests__/notificationService.test.js`:
```js
'use strict';
jest.mock('../services/pushService', () => ({ sendToUser: jest.fn().mockResolvedValue({ sent: 1, pruned: 0 }) }));
jest.mock('../services/prefsService', () => ({
  DEFAULT_PREFS: { assignments:true, mentions:true, comments:false, reminders:true, muteProjects:[], quietHours:null },
  getPrefs: jest.fn(),
}));
const pushService = require('../services/pushService');
const prefsService = require('../services/prefsService');
const svc = require('../services/notificationService');

const D = { assignments:true, mentions:true, comments:false, reminders:true, muteProjects:[], quietHours:null };

describe('notificationService.isAllowed', () => {
  test('category toggle off → not allowed', () => {
    expect(svc.isAllowed({ ...D, comments:false }, 'comments', 10, new Date('2026-06-23T12:00:00'))).toBe(false);
    expect(svc.isAllowed({ ...D, assignments:true }, 'assignments', 10, new Date('2026-06-23T12:00:00'))).toBe(true);
  });
  test('muted project → not allowed even when category on', () => {
    expect(svc.isAllowed({ ...D, muteProjects:[10] }, 'assignments', 10, new Date('2026-06-23T12:00:00'))).toBe(false);
    expect(svc.isAllowed({ ...D, muteProjects:[10] }, 'assignments', 11, new Date('2026-06-23T12:00:00'))).toBe(true);
  });
  test('quiet hours suppress (non-wrapping window 22-7 covers 23:00)', () => {
    const now = new Date('2026-06-23T23:00:00'); // local hour 23
    expect(svc.isAllowed({ ...D, quietHours:{ start:22, end:7 } }, 'assignments', 1, now)).toBe(false);
  });
  test('quiet hours allow outside window (12:00 not in 22-7)', () => {
    const now = new Date('2026-06-23T12:00:00');
    expect(svc.isAllowed({ ...D, quietHours:{ start:22, end:7 } }, 'assignments', 1, now)).toBe(true);
  });
});

describe('notificationService.notifyAssignment', () => {
  beforeEach(() => jest.clearAllMocks());
  test('sends when allowed and recipient ≠ actor', async () => {
    prefsService.getPrefs.mockResolvedValueOnce({ ...D });
    const pool = {};
    await svc.notifyAssignment(pool, {
      assigneeId: 2, actorId: 1, projectId: 5, listId: 9,
      item: { id: 99, text: 'Book caterer' },
      workspaceId: 3,
    });
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, uid, payload] = pushService.sendToUser.mock.calls[0];
    expect(uid).toBe(2);
    expect(payload.title).toMatch(/assigned/i);
    expect(payload.body).toContain('Book caterer');
    expect(payload.url).toBe('/w/3/p/5/l/9?item=99');
  });
  test('does not send to the actor themselves', async () => {
    const pool = {};
    await svc.notifyAssignment(pool, { assigneeId: 1, actorId: 1, projectId: 5, listId: 9, item: { id: 1, text: 'x' }, workspaceId: 3 });
    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });
  test('suppressed when category off', async () => {
    prefsService.getPrefs.mockResolvedValueOnce({ ...D, assignments:false });
    await svc.notifyAssignment({}, { assigneeId: 2, actorId: 1, projectId: 5, listId: 9, item: { id: 1, text: 'x' }, workspaceId: 3 });
    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });
});

describe('notificationService.notifyDueReminder', () => {
  beforeEach(() => jest.clearAllMocks());
  test('sends reminder when allowed', async () => {
    prefsService.getPrefs.mockResolvedValueOnce({ ...D });
    await svc.notifyDueReminder({}, { assigneeId: 4, item: { id: 7, text: 'Pay deposit' }, projectId: 2, listId: 3, workspaceId: 1, kind: 'today' });
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, uid, payload] = pushService.sendToUser.mock.calls[0];
    expect(uid).toBe(4);
    expect(payload.body).toContain('Pay deposit');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest notificationService
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/services/notificationService.js`**

```js
'use strict';
const pushService = require('./pushService');
const prefsService = require('./prefsService');

function deepLink({ workspaceId, projectId, listId, itemId }) {
  if (workspaceId && projectId && listId) {
    const q = itemId ? `?item=${itemId}` : '';
    return `/w/${workspaceId}/p/${projectId}/l/${listId}${q}`;
  }
  return '/';
}

function inQuietHours(quietHours, now) {
  if (!quietHours) return false;
  const { start, end } = quietHours;
  const h = now.getHours();
  if (start === end) return false;
  if (start < end) return h >= start && h < end;     // non-wrapping
  return h >= start || h < end;                      // wraps midnight
}

function isAllowed(prefs, category, projectId, now) {
  if (!prefs[category]) return false;
  if (projectId != null && Array.isArray(prefs.muteProjects) && prefs.muteProjects.includes(Number(projectId))) return false;
  if (inQuietHours(prefs.quietHours, now)) return false;
  return true;
}

async function gateAndSend(pool, { recipientId, category, projectId, payload, now = new Date() }) {
  if (recipientId == null) return;
  const prefs = await prefsService.getPrefs(pool, recipientId);
  if (!isAllowed(prefs, category, projectId, now)) return;
  await pushService.sendToUser(pool, recipientId, payload);
}

async function notifyAssignment(pool, { assigneeId, actorId, item, projectId, listId, workspaceId }) {
  if (assigneeId == null || assigneeId === actorId) return;
  await gateAndSend(pool, {
    recipientId: assigneeId, category: 'assignments', projectId,
    payload: {
      title: 'You were assigned an item',
      body: item.text,
      url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
      tag: `assign-${item.id}`,
    },
  });
}

async function notifyMention(pool, { mentionedUserId, actorId, item, projectId, listId, workspaceId, commentId }) {
  if (mentionedUserId == null || mentionedUserId === actorId) return;
  await gateAndSend(pool, {
    recipientId: mentionedUserId, category: 'mentions', projectId,
    payload: {
      title: 'You were mentioned',
      body: item.text,
      url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
      tag: `mention-${commentId}`,
    },
  });
}

async function notifyComment(pool, { watcherIds = [], actorId, item, projectId, listId, workspaceId, commentId }) {
  for (const wid of watcherIds) {
    if (wid === actorId) continue;
    await gateAndSend(pool, {
      recipientId: wid, category: 'comments', projectId,
      payload: {
        title: 'New comment',
        body: item.text,
        url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
        tag: `comment-${commentId}`,
      },
    });
  }
}

async function notifyDueReminder(pool, { assigneeId, item, projectId, listId, workspaceId, kind }) {
  const prefix = kind === 'overdue' ? 'Overdue' : kind === 'soon' ? 'Due soon' : 'Due today';
  await gateAndSend(pool, {
    recipientId: assigneeId, category: 'reminders', projectId,
    payload: {
      title: `${prefix}: ${item.text}`,
      body: item.text,
      url: deepLink({ workspaceId, projectId, listId, itemId: item.id }),
      tag: `reminder-${item.id}`,
    },
  });
}

module.exports = { deepLink, inQuietHours, isAllowed, notifyAssignment, notifyMention, notifyComment, notifyDueReminder };
```

- [ ] **Step 4: Run, expect pass**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest notificationService
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/notificationService.js backend/__tests__/notificationService.test.js
git commit -m "feat(6.T3): notificationService prefs-aware policy layer (assignments/mentions/comments/reminders)"
```

---

### Task 4: `routes/push.js` — subscription + prefs endpoints, mounted in server.js

**Files:**
- Create: `backend/routes/push.js`
- Create: `backend/__tests__/push.integration.test.js`
- Modify: `backend/server.js` (mount the router)

**Interfaces:**
- Consumes: `pushService` (publicKey/saveSubscription/deleteSubscription), `prefsService` (getPrefs/setPrefs), `db/pool`.
- Produces: routes `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET /api/notification-prefs`, `PUT /api/notification-prefs`.
- Factory style: `module.exports = (authenticateToken) => router` (no sanitize/emit needed). Mounted with `app.use('/api', require('./routes/push')(authenticateToken));`

- [ ] **Step 1: Write the failing real-router integration test**

`backend/__tests__/push.integration.test.js` (real router via supertest, mirrors `hub.integration.test.js`; mocks `pushService` so no real web-push). Use a fresh test user. Key assertions:
```js
'use strict';
jest.mock('../services/pushService', () => ({
  publicKey: () => 'TEST_PUBLIC_KEY',
  isEnabled: () => true,
  saveSubscription: jest.fn().mockResolvedValue({ id: 1 }),
  deleteSubscription: jest.fn().mockResolvedValue(undefined),
}));
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const pushService = require('../services/pushService');

const SECRET = process.env.JWT_SECRET || 'test-secret';
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'no token' });
  try { req.user = jwt.verify(t, SECRET); next(); }
  catch { return res.status(401).json({ error: 'bad token' }); }
}

let app, userId, token;
beforeAll(async () => {
  const u = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id`,
    ['push-test@example.com', 'x']
  );
  userId = u.rows[0].id;
  token = jwt.sign({ id: userId, email: 'push-test@example.com' }, SECRET);
  app = express();
  app.use(express.json());
  app.use('/api', require('../routes/push')(authMiddleware));
});
afterAll(async () => {
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM notification_prefs WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

test('GET /push/vapid-public-key returns the key', async () => {
  const r = await request(app).get('/api/push/vapid-public-key').set('Authorization', `Bearer ${token}`);
  expect(r.status).toBe(200);
  expect(r.body.publicKey).toBe('TEST_PUBLIC_KEY');
});
test('POST /push/subscribe validates body and calls saveSubscription', async () => {
  const r = await request(app).post('/api/push/subscribe')
    .set('Authorization', `Bearer ${token}`)
    .send({ subscription: { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } } });
  expect(r.status).toBe(201);
  expect(pushService.saveSubscription).toHaveBeenCalledWith(expect.anything(), userId, { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } });
});
test('POST /push/subscribe 400 on missing endpoint', async () => {
  const r = await request(app).post('/api/push/subscribe').set('Authorization', `Bearer ${token}`).send({ subscription: { keys: {} } });
  expect(r.status).toBe(400);
});
test('GET /notification-prefs returns defaults for a new user', async () => {
  const r = await request(app).get('/api/notification-prefs').set('Authorization', `Bearer ${token}`);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ assignments: true, comments: false });
});
test('PUT /notification-prefs persists a change', async () => {
  const r = await request(app).put('/api/notification-prefs').set('Authorization', `Bearer ${token}`).send({ comments: true });
  expect(r.status).toBe(200);
  expect(r.body.comments).toBe(true);
  const again = await request(app).get('/api/notification-prefs').set('Authorization', `Bearer ${token}`);
  expect(again.body.comments).toBe(true);
});
test('401 without token', async () => {
  const r = await request(app).get('/api/notification-prefs');
  expect(r.status).toBe(401);
});
```

- [ ] **Step 2: Run, expect fail**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npm run test:integration -- push
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/routes/push.js`**

```js
'use strict';
const express = require('express');
const pool = require('../db/pool');
const pushService = require('../services/pushService');
const prefsService = require('../services/prefsService');

module.exports = (authenticateToken) => {
  const router = express.Router();
  router.use(authenticateToken);

  router.get('/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: pushService.publicKey() });
  });

  router.post('/push/subscribe', async (req, res) => {
    try {
      const sub = req.body && req.body.subscription;
      if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }
      await pushService.saveSubscription(pool, req.user.id, { endpoint: sub.endpoint, keys: sub.keys });
      res.status(201).json({ ok: true });
    } catch (e) {
      console.error('POST /push/subscribe error:', e);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });

  router.post('/push/unsubscribe', async (req, res) => {
    try {
      const endpoint = req.body && req.body.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
      await pushService.deleteSubscription(pool, endpoint);
      res.json({ ok: true });
    } catch (e) {
      console.error('POST /push/unsubscribe error:', e);
      res.status(500).json({ error: 'Failed to remove subscription' });
    }
  });

  router.get('/notification-prefs', async (req, res) => {
    try {
      res.json(await prefsService.getPrefs(pool, req.user.id));
    } catch (e) {
      console.error('GET /notification-prefs error:', e);
      res.status(500).json({ error: 'Failed to load prefs' });
    }
  });

  router.put('/notification-prefs', async (req, res) => {
    try {
      res.json(await prefsService.setPrefs(pool, req.user.id, req.body || {}));
    } catch (e) {
      console.error('PUT /notification-prefs error:', e);
      res.status(500).json({ error: 'Failed to save prefs' });
    }
  });

  return router;
};
```

- [ ] **Step 4: Mount in `backend/server.js`**

Find where the other route factories are mounted (search for `require('./routes/comments')` / `require('./routes/fields')`). Add alongside them:
```js
app.use('/api', require('./routes/push')(authenticateToken));
```
(`push.js` needs only `authenticateToken` — it does not take `sanitizeInput` or the emit object.)

- [ ] **Step 5: Run, expect pass**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npm run test:integration -- push
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/push.js backend/__tests__/push.integration.test.js backend/server.js
git commit -m "feat(6.T4): routes/push.js (vapid-key/subscribe/unsubscribe/prefs) mounted in server.js"
```

---

### Task 5: Wire notification triggers (assignment, mention, comment) + reset reminder_sent

**Files:**
- Modify: `backend/server.js` (item-update: reset `reminder_sent` on due_date change; call `notifyAssignment`)
- Modify: `backend/routes/comments.js` (call `notifyMention` per resolved mention; call `notifyComment` to assignee-as-watcher)
- Modify/Create: `backend/__tests__/notification-triggers.test.js` (unit, REPLICA pattern for the server.js path; direct assertion for comments via spy)

**Interfaces:**
- Consumes: `notificationService.notifyAssignment/notifyMention/notifyComment`.
- Note: server.js item endpoints are INLINE (carry-forward) — its unit test uses the established handler-REPLICA pattern (see `cross-list-move.test.js`). The comments path is a real router (factory) so it is tested by spying on `notificationService`.

- [ ] **Step 1: Reset `reminder_sent` when due_date changes (server.js)**

In the item PUT field-building block, change the `due_date` clause (currently `backend/server.js:935-938`) to also clear the reminder flag so a rescheduled item re-arms:
```js
if (due_date !== undefined) {
  query += `, due_date = $${paramCount++}`;
  params.push(due_date);
  query += `, reminder_sent = FALSE`;
}
```

- [ ] **Step 2: Call `notifyAssignment` at the activity site (server.js)**

In the best-effort activity block (currently `backend/server.js:1000-1025`), after recording activity, when the assignee changed, fire the assignment push. Use the already-computed `workspaceId`, `projectId`, `prev_assignee_id`, `updatedItem`, `req.user.id`, `targetListId`:
```js
// Push (best-effort — never fail the response)
try {
  const notificationService = require('./services/notificationService');
  if (updatedItem.assignee_id && updatedItem.assignee_id !== prev_assignee_id) {
    await notificationService.notifyAssignment(pool, {
      assigneeId: updatedItem.assignee_id,
      actorId: req.user.id,
      item: updatedItem,
      projectId,
      listId: targetListId,
      workspaceId,
    });
  }
} catch (pushErr) {
  console.error('Assignment push failed (non-fatal):', pushErr);
}
```
(Place this inside the existing `if (workspaceId) { ... }` block so `projectId`/`workspaceId` are in scope.)

- [ ] **Step 3: Call mention + comment push (comments.js)**

In `backend/routes/comments.js`, inside the mention loop (currently around line 92-102), after recording the `mentioned` activity row, add:
```js
try {
  const notificationService = require('../services/notificationService');
  await notificationService.notifyMention(pool, {
    mentionedUserId: member.user_id,
    actorId: req.user.id,
    item: { id: Number(req.params.id), text: itemText },
    projectId, listId: access.listId, workspaceId,
    commentId: comment.id,
  });
} catch (e) { console.error('Mention push failed (non-fatal):', e); }
```
And after the mention loop, notify the item's assignee as a watcher (skip if they are the actor or were already mentioned). Fetch `itemText` and `assigneeId` once (add near the top of the activity block):
```js
const itemRow = await pool.query('SELECT text, assignee_id FROM list_items WHERE id = $1', [req.params.id]);
const itemText = itemRow.rows[0] ? itemRow.rows[0].text : '';
const assigneeId = itemRow.rows[0] ? itemRow.rows[0].assignee_id : null;
// ... after mention loop:
try {
  const notificationService = require('../services/notificationService');
  await notificationService.notifyComment(pool, {
    watcherIds: assigneeId ? [assigneeId] : [],
    actorId: req.user.id,
    item: { id: Number(req.params.id), text: itemText },
    projectId, listId: access.listId, workspaceId,
    commentId: comment.id,
  });
} catch (e) { console.error('Comment push failed (non-fatal):', e); }
```

- [ ] **Step 4: Write the trigger tests**

`backend/__tests__/notification-triggers.test.js` — spy on `notificationService` and assert the comments router calls `notifyMention` for a mention and `notifyComment` for the assignee. Mount the real comments router with a mocked `notificationService`, `pushService`, and a mocked `pool`/services so no DB is needed; OR add to the existing comments integration test. Minimum assertions:
- posting a comment with `@bob` calls `notifyMention` with `mentionedUserId` = bob's id.
- posting a comment on an item assigned to carol (actor ≠ carol) calls `notifyComment` with `watcherIds` containing carol's id.
- a self-comment by the assignee does not notify themselves.

(If mounting the real router is impractical in a unit test, extend `backend/__tests__/comments.integration.test.js` with `jest.mock('../services/notificationService')` and assert the spy calls. The integration harness already has users/lists/items set up.)

- [ ] **Step 5: Run the relevant suites, expect pass**

```bash
docker compose --profile test build backend-test \
 && docker compose --profile test run --rm backend-test npx jest notification-triggers cross-list-move \
 && docker compose --profile test run --rm backend-test npm run test:integration -- comments
```
Expected: PASS (existing cross-list-move + comments suites stay green; new trigger assertions pass).

- [ ] **Step 6: Commit**

```bash
git add backend/server.js backend/routes/comments.js backend/__tests__/notification-triggers.test.js
git commit -m "feat(6.T5): wire assignment/mention/comment push triggers + reset reminder_sent on due_date change"
```

---

### Task 6: `jobs/reminders.js` — due-date reminder sweep + boot-guarded interval

**Files:**
- Create: `backend/jobs/reminders.js`
- Create: `backend/__tests__/reminders.test.js`
- Modify: `backend/server.js` (start the job at boot, guarded)

**Interfaces:**
- Consumes: `notificationService.notifyDueReminder`, `pushService.isEnabled`, `db/pool`.
- Produces: `findDueItems(pool, now)`, `runReminderSweep(pool, now)`, `startReminderJob(pool, { intervalMs })`.
- `kind` derivation: overdue if `due_date < startOfToday`; today if `due_date` within `[startOfToday, endOfToday]`; soon if within next 24h beyond today. Only items with `assignee_id IS NOT NULL`, `completed = FALSE`, `reminder_sent = FALSE`, and `due_date <= now + 24h`.

- [ ] **Step 1: Write the failing test**

`backend/__tests__/reminders.test.js`:
```js
'use strict';
jest.mock('../services/notificationService', () => ({ notifyDueReminder: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/pushService', () => ({ isEnabled: jest.fn(() => true) }));
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');
const job = require('../jobs/reminders');

describe('reminders.runReminderSweep', () => {
  beforeEach(() => jest.clearAllMocks());

  test('queries due items, notifies assignee, marks reminder_sent', async () => {
    const now = new Date('2026-06-23T09:00:00Z');
    const due = [
      { id: 7, text: 'Pay deposit', due_date: '2026-06-23T00:00:00Z', assignee_id: 4, list_id: 3, project_id: 2, workspace_id: 1, kind: 'today' },
    ];
    const pool = { query: jest.fn() };
    pool.query.mockResolvedValueOnce({ rows: due }); // findDueItems
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE reminder_sent

    const res = await job.runReminderSweep(pool, now);

    expect(notificationService.notifyDueReminder).toHaveBeenCalledTimes(1);
    const [, arg] = notificationService.notifyDueReminder.mock.calls[0];
    expect(arg.assigneeId).toBe(4);
    expect(arg.item.id).toBe(7);
    // marked sent
    const updateCall = pool.query.mock.calls.find(c => /UPDATE list_items SET reminder_sent = TRUE/.test(c[0]));
    expect(updateCall).toBeTruthy();
    expect(updateCall[1]).toEqual([[7]]);
    expect(res).toEqual({ scanned: 1, sent: 1 });
  });

  test('no due items → no notifications, no update', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    const res = await job.runReminderSweep(pool, new Date());
    expect(notificationService.notifyDueReminder).not.toHaveBeenCalled();
    expect(res).toEqual({ scanned: 0, sent: 0 });
  });
});

describe('reminders.startReminderJob', () => {
  test('no-ops when push disabled', () => {
    pushService.isEnabled.mockReturnValueOnce(false);
    const handle = job.startReminderJob({ query: jest.fn() }, { intervalMs: 1000 });
    expect(handle).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest reminders
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/jobs/reminders.js`**

```js
'use strict';
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

// Query items due within the next 24h (or overdue) that still need a reminder.
// Joins list → project → workspace for the deep link. Derives `kind` in SQL.
async function findDueItems(pool, now) {
  const result = await pool.query(
    `SELECT li.id, li.text, li.due_date, li.assignee_id,
            li.list_id,
            p.id   AS project_id,
            p.workspace_id AS workspace_id,
            CASE
              WHEN li.due_date < date_trunc('day', $1::timestamptz) THEN 'overdue'
              WHEN li.due_date < date_trunc('day', $1::timestamptz) + interval '1 day' THEN 'today'
              ELSE 'soon'
            END AS kind
     FROM list_items li
     JOIN lists l    ON l.id = li.list_id
     LEFT JOIN projects p ON p.id = l.project_id
     WHERE li.assignee_id IS NOT NULL
       AND li.completed = FALSE
       AND li.reminder_sent = FALSE
       AND li.due_date IS NOT NULL
       AND li.due_date <= $1::timestamptz + interval '24 hours'`,
    [now]
  );
  return result.rows;
}

async function runReminderSweep(pool, now = new Date()) {
  const items = await findDueItems(pool, now);
  if (items.length === 0) return { scanned: 0, sent: 0 };

  const notified = [];
  for (const it of items) {
    try {
      await notificationService.notifyDueReminder(pool, {
        assigneeId: it.assignee_id,
        item: { id: it.id, text: it.text },
        projectId: it.project_id,
        listId: it.list_id,
        workspaceId: it.workspace_id,
        kind: it.kind,
      });
      notified.push(it.id);
    } catch (e) {
      console.error('reminder notify failed (non-fatal):', e);
    }
  }

  if (notified.length > 0) {
    await pool.query('UPDATE list_items SET reminder_sent = TRUE WHERE id = ANY($1)', [notified]);
  }
  return { scanned: items.length, sent: notified.length };
}

function startReminderJob(pool, { intervalMs = 15 * 60 * 1000 } = {}) {
  if (!pushService.isEnabled()) {
    console.warn('reminders: push disabled — reminder job not started.');
    return null;
  }
  const timer = setInterval(() => {
    runReminderSweep(pool, new Date()).catch((e) => console.error('reminder sweep error (non-fatal):', e));
  }, intervalMs);
  if (timer.unref) timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { findDueItems, runReminderSweep, startReminderJob };
```

- [ ] **Step 4: Start the job at boot (server.js)**

Near the bottom of `backend/server.js` where the server starts listening (search for `app.listen` / `server.listen`), after migrations run, add:
```js
// Due-date reminder sweep (in-process; no-ops if VAPID keys absent). Guarded for tests.
if (process.env.NODE_ENV !== 'test') {
  try {
    require('./jobs/reminders').startReminderJob(pool, {});
  } catch (e) {
    console.error('Failed to start reminder job (non-fatal):', e);
  }
}
```

- [ ] **Step 5: Run, expect pass**

```bash
docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npx jest reminders
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/jobs/reminders.js backend/__tests__/reminders.test.js backend/server.js
git commit -m "feat(6.T6): jobs/reminders.js due-date sweep + boot-guarded interval"
```

---

### Task 7: Vite PWA plugin — manifest, icons, service worker registration

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `frontend/package.json` (add `vite-plugin-pwa`, `workbox-precaching`, `workbox-window` to devDependencies)
- Create: `frontend/src/sw.js` (skeleton: precache only — push handlers come in Task 8)
- Create: `frontend/public/icons/icon-192.png`, `frontend/public/icons/icon-512.png`, `frontend/public/icons/maskable-512.png` (generated placeholder icons — see step)
- Modify: `frontend/src/main.jsx` (register the SW on boot)
- Create: `frontend/src/lib/__tests__/pwa-config.test.js` (asserts manifest fields via importing the config)

**Interfaces:**
- Produces: a registered service worker at `/sw.js`; `manifest.webmanifest` with name/short_name/theme/icons/standalone.

- [ ] **Step 1: Add dependencies**

In `frontend/package.json` devDependencies add `"vite-plugin-pwa": "^0.20.5"`, `"workbox-precaching": "^7.1.0"`, `"workbox-window": "^7.1.0"`. Install:
```bash
cd frontend && npm install
```

- [ ] **Step 2: Generate placeholder PWA icons**

Create simple brand-colored PNG icons (the design uses the existing `Logo` mark; for now a solid rounded square in the primary token color is acceptable). Use the existing `frontend/public/` for static assets. Produce `icon-192.png` (192×192), `icon-512.png` (512×512), and `maskable-512.png` (512×512 with safe-area padding). If no image tooling is available, copy the existing favicon/logo asset to these names and note in the report that final icons are a follow-up. Icons must exist so the manifest validates.

- [ ] **Step 3: Configure the plugin (`frontend/vite.config.js`)**

Add the import and plugin (keep existing `react()` + the dev proxy intact):
```js
import { VitePWA } from 'vite-plugin-pwa'

// inside plugins: [...]
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  registerType: 'autoUpdate',
  injectRegister: null, // we register manually in main.jsx
  manifest: {
    name: 'CollaborList',
    short_name: 'CollaborList',
    description: 'Plan together — lists, tasks, and your wedding, in real time.',
    theme_color: '#4f46e5',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
  devOptions: { enabled: false },
})
```
NOTE: `theme_color`/`background_color` here are manifest JSON values consumed by the OS, NOT app UI — the no-hardcoded-hex rule applies to component styling, not the manifest. Use the project's primary brand hex for `theme_color`.

- [ ] **Step 4: SW skeleton (`frontend/src/sw.js`)**

```js
/* global self */
import { precacheAndRoute } from 'workbox-precaching'

// Injected at build by vite-plugin-pwa (injectManifest).
precacheAndRoute(self.__WB_MANIFEST || [])

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
// push + notificationclick handlers added in Task 8.
```

- [ ] **Step 5: Register the SW on boot (`frontend/src/main.jsx`)**

Import and call the registration helper (created in Task 9's `lib/push.js`; for this task, inline a minimal registration so the SW loads). Add after the app renders:
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW registration failed:', e))
  })
}
```
(Task 9 replaces this inline call with `registerServiceWorker()` from `lib/push.js`. Leaving the inline form here keeps this task independently shippable.)

- [ ] **Step 6: Build to verify the SW + manifest emit**

```bash
cd frontend && npm run build
```
Expected: build succeeds; `dist/sw.js`, `dist/manifest.webmanifest`, and the icons are present:
```bash
ls dist/sw.js dist/manifest.webmanifest dist/icons/
```

- [ ] **Step 7: Add a lightweight config assertion test**

`frontend/src/lib/__tests__/pwa-config.test.js` — import the manifest object (export it from `vite.config.js` or re-declare in a small `frontend/src/lib/pwaManifest.js` that the config imports) and assert `name === 'CollaborList'`, `display === 'standalone'`, three icons present. (Prefer: extract the manifest literal into `frontend/src/lib/pwaManifest.js`, import it in `vite.config.js`, and test that module — avoids importing the full vite config in vitest.)

- [ ] **Step 8: Run the frontend suite, expect green**

```bash
cd frontend && npm test
```
Expected: all green including the new config test.

- [ ] **Step 9: Commit**

```bash
git add frontend/vite.config.js frontend/package.json frontend/package-lock.json frontend/src/sw.js frontend/src/main.jsx frontend/public/icons frontend/src/lib/pwaManifest.js frontend/src/lib/__tests__/pwa-config.test.js
git commit -m "feat(6.T7): vite-plugin-pwa manifest + icons + service worker registration"
```

---

### Task 8: Service-worker push + notificationclick handlers (deep-link)

**Files:**
- Create: `frontend/src/lib/swPush.js` (pure helpers — unit-testable)
- Modify: `frontend/src/sw.js` (wire `push` + `notificationclick` to the helpers)
- Create: `frontend/src/lib/__tests__/swPush.test.js`

**Interfaces:**
- Produces: `buildNotification(data)`, `notificationTargetUrl(data)` (signatures above). The SW imports these and calls them in its event listeners.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/__tests__/swPush.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildNotification, notificationTargetUrl } from '../swPush'

describe('swPush.buildNotification', () => {
  it('maps payload to title + options with data.url', () => {
    const n = buildNotification({ title: 'Assigned', body: 'Book caterer', url: '/w/1/p/2/l/3?item=9', tag: 'assign-9' })
    expect(n.title).toBe('Assigned')
    expect(n.options.body).toBe('Book caterer')
    expect(n.options.data.url).toBe('/w/1/p/2/l/3?item=9')
    expect(n.options.tag).toBe('assign-9')
  })
  it('falls back to a default title/body when missing', () => {
    const n = buildNotification({})
    expect(n.title).toBe('CollaborList')
    expect(n.options.data.url).toBe('/')
  })
})

describe('swPush.notificationTargetUrl', () => {
  it('returns the url from notification data', () => {
    expect(notificationTargetUrl({ url: '/w/1/p/2/l/3' })).toBe('/w/1/p/2/l/3')
  })
  it('defaults to / when absent', () => {
    expect(notificationTargetUrl({})).toBe('/')
    expect(notificationTargetUrl(null)).toBe('/')
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
cd frontend && npm test -- swPush
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/lib/swPush.js`**

```js
// Pure helpers shared with the service worker. No DOM / no SW globals here so
// they are unit-testable; sw.js wires them to self.addEventListener.

export function notificationTargetUrl(data) {
  if (data && typeof data.url === 'string' && data.url) return data.url
  return '/'
}

export function buildNotification(payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  return {
    title: data.title || 'CollaborList',
    options: {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: notificationTargetUrl(data) },
    },
  }
}
```

- [ ] **Step 4: Wire the SW (`frontend/src/sw.js`)**

Add below the existing skeleton:
```js
import { buildNotification, notificationTargetUrl } from './lib/swPush'

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const { title, options } = buildNotification(payload)
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = notificationTargetUrl(event.notification.data)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) { client.navigate(url); return client.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
```

- [ ] **Step 5: Run tests + build, expect pass**

```bash
cd frontend && npm test -- swPush && npm run build
```
Expected: swPush tests PASS; build emits `dist/sw.js`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/swPush.js frontend/src/sw.js frontend/src/lib/__tests__/swPush.test.js
git commit -m "feat(6.T8): service-worker push + notificationclick deep-link handlers"
```

---

### Task 9: `lib/push.js` subscription flow + React Query hooks

**Files:**
- Create: `frontend/src/lib/push.js`
- Modify: `frontend/src/lib/api.js` (add 5 hooks)
- Modify: `frontend/src/main.jsx` (use `registerServiceWorker()` from lib/push)
- Create: `frontend/src/lib/__tests__/push.test.js`
- Modify: `frontend/src/lib/__tests__/api.*.test.jsx` (add hook tests — or a new `api.push.test.jsx`)

**Interfaces:**
- Consumes: `apiClient` (from `lib/api.js`) for the HTTP calls.
- Produces: `urlBase64ToUint8Array`, `registerServiceWorker`, `getPermission`, `subscribeToPush(vapidPublicKey)`, `unsubscribeFromPush`; hooks `useVapidKey`, `usePushSubscribe`, `usePushUnsubscribe`, `useNotificationPrefs`, `useUpdateNotificationPrefs`.

- [ ] **Step 1: Write the failing test for `urlBase64ToUint8Array`**

`frontend/src/lib/__tests__/push.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from '../push'

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key to a Uint8Array of the right length', () => {
    // "BIN" base64url → 3 bytes; verify it returns a Uint8Array and round-trips known bytes
    const out = urlBase64ToUint8Array('AAAA') // 3 bytes of zero
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBe(3)
    expect(Array.from(out)).toEqual([0, 0, 0])
  })
  it('handles base64url chars (- and _) and missing padding', () => {
    expect(() => urlBase64ToUint8Array('a-_b')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
cd frontend && npm test -- push
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/lib/push.js`**

```js
import { apiClient } from './api'

// Convert a base64url-encoded VAPID public key to the Uint8Array the
// PushManager.subscribe applicationServerKey requires.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

export function getPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

export async function subscribeToPush(vapidPublicKey) {
  if (!pushSupported() || !vapidPublicKey) return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  const json = sub.toJSON()
  await apiClient.post('/push/subscribe', {
    subscription: { endpoint: json.endpoint, keys: json.keys },
  })
  return json
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return false
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await apiClient.post('/push/unsubscribe', { endpoint })
  return true
}
```

- [ ] **Step 4: Add hooks to `frontend/src/lib/api.js`**

Follow the existing hook patterns (the same file already has `useFieldDefs`, `useSetItemField`, etc.). Add:
```js
export function useVapidKey() {
  return useQuery({
    queryKey: ['vapidKey'],
    queryFn: async () => (await apiClient.get('/push/vapid-public-key')).data.publicKey,
    staleTime: Infinity,
  })
}
export function usePushSubscribe() {
  return useMutation({
    mutationFn: (subscription) => apiClient.post('/push/subscribe', { subscription }),
  })
}
export function usePushUnsubscribe() {
  return useMutation({
    mutationFn: (endpoint) => apiClient.post('/push/unsubscribe', { endpoint }),
  })
}
export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notificationPrefs'],
    queryFn: async () => (await apiClient.get('/notification-prefs')).data,
  })
}
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial) => apiClient.put('/notification-prefs', partial).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['notificationPrefs'], data),
  })
}
```

- [ ] **Step 5: Use `registerServiceWorker` in `main.jsx`**

Replace the inline registration from Task 7 with:
```js
import { registerServiceWorker } from './lib/push'
// ...after render:
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { registerServiceWorker() })
}
```

- [ ] **Step 6: Add hook tests**

In a new `frontend/src/lib/__tests__/api.push.test.jsx` (mirror the existing api test pattern that mocks `apiClient`): `useNotificationPrefs` hits `GET /notification-prefs`; `useUpdateNotificationPrefs` PUTs and sets `['notificationPrefs']` cache; `useVapidKey` GETs the key.

- [ ] **Step 7: Run tests + build, expect pass**

```bash
cd frontend && npm test -- push api.push && npm run build
```
Expected: PASS; build OK.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/push.js frontend/src/lib/api.js frontend/src/main.jsx frontend/src/lib/__tests__/push.test.js frontend/src/lib/__tests__/api.push.test.jsx
git commit -m "feat(6.T9): push subscription flow (lib/push) + notification React Query hooks"
```

---

### Task 10: Notification UI — Enable button, prefs sheet, install hint, settings entry

**Files:**
- Create: `frontend/src/features/notifications/EnableNotifications.jsx`
- Create: `frontend/src/features/notifications/NotificationPrefs.jsx`
- Create: `frontend/src/features/notifications/InstallHint.jsx`
- Create: `frontend/src/features/notifications/__tests__/EnableNotifications.test.jsx`
- Create: `frontend/src/features/notifications/__tests__/NotificationPrefs.test.jsx`
- Modify: the existing account/top-bar menu component to add a "Notifications" entry that renders these (implementer locates it — search for the "Log out" button found in `frontend/src/` to find the header/account menu).

**Interfaces:**
- Consumes: `useVapidKey`, `useNotificationPrefs`, `useUpdateNotificationPrefs` (api.js); `subscribeToPush`, `unsubscribeFromPush`, `getPermission`, `pushSupported` (lib/push.js); `ui/` primitives (`Button`, `Sheet`, `SegmentedControl`/toggle, `Field`).

- [ ] **Step 1: `EnableNotifications.jsx`**

A button + status line. Behavior:
- If `!pushSupported()` → show a muted line "Notifications aren't supported on this browser." `data-testid="push-unsupported"`.
- If `getPermission() === 'denied'` → muted line "Notifications are blocked in your browser settings." `data-testid="push-denied"`.
- If `getPermission() === 'granted'` → show "Notifications on" + a "Turn off" button calling `unsubscribeFromPush()`. `data-testid="push-on"`.
- Else → an "Enable notifications" button (`data-testid="enable-push-btn"`) that reads the VAPID key (`useVapidKey`) and calls `subscribeToPush(key)`; on success flips to the granted state.
- Always render the `InstallHint` above the button on iOS (since push needs install first).

- [ ] **Step 2: `InstallHint.jsx`**

Detect iOS Safari (`/iP(hone|ad|od)/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches`). When iOS-not-installed → show: "On iPhone: tap the Share icon, then 'Add to Home Screen' to install and get reminders." `data-testid="ios-install-hint"`. On Android/desktop, capture `beforeinstallprompt` and show an "Install app" button (`data-testid="install-app-btn"`) that calls the saved event's `prompt()`. Render nothing when already installed (standalone display-mode).

- [ ] **Step 3: `NotificationPrefs.jsx`**

A `ui/Sheet` titled "Notifications" with:
- `EnableNotifications` at the top.
- Four category toggles bound to `useNotificationPrefs()` data, persisting via `useUpdateNotificationPrefs().mutate({ <key>: value })`: Assignments, Mentions, Comments, Due reminders. testids `pref-assignments` / `pref-mentions` / `pref-comments` / `pref-reminders`.
- Quiet hours: two number inputs (start/end 0–23) → `mutate({ quietHours: { start, end } })`, plus a "Clear" → `mutate({ quietHours: null })`. testid `pref-quiet-hours`.
- (Mute-project is per-project; expose it on the Project settings view in a follow-up — out of scope here. Note this in the report.)
- `data-testid="notification-prefs"`.

- [ ] **Step 4: Wire a settings entry**

In the account/top-bar menu (where "Log out" lives), add a "Notifications" button (`data-testid="open-notifications-btn"`) that opens the `NotificationPrefs` sheet (local open state).

- [ ] **Step 5: Tests**

`EnableNotifications.test.jsx` — mock `lib/push` + `lib/api`: unsupported → shows `push-unsupported`; default permission → clicking `enable-push-btn` calls `subscribeToPush` with the fetched key; granted → shows `push-on`. `NotificationPrefs.test.jsx` — toggling a category calls `useUpdateNotificationPrefs.mutate({ <key>: <bool> })`; renders the four toggles reflecting fetched prefs.

- [ ] **Step 6: Run tests + build, expect pass**

```bash
cd frontend && npm test && npm run build
```
Expected: full suite green; build OK.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/notifications frontend/src/features/notifications/__tests__ <modified-menu-file>
git commit -m "feat(6.T10): notification UI — enable button, prefs sheet, install hint, settings entry"
```

---

## Post-implementation: local verification (no live push)

After Task 10, verify what CAN be verified without VAPID keys / HTTPS / a real device:
- `cd frontend && npm run build` then serve `dist/` and confirm in Chrome DevTools → Application: the manifest parses, the service worker registers and activates, and "Add to Home Screen" is offered. (Push send itself needs VAPID keys + the user's device — leave for the user.)
- Backend: full unit + integration suites green (`docker compose --profile test build backend-test` then both run commands).
- Confirm `pushService.isEnabled()` is `false` without keys and the app/boot does NOT crash and the reminder job logs "push disabled — reminder job not started."

## Pre-deploy items for the user (document in the final report, do not perform)
- Generate a VAPID keypair (`npx web-push generate-vapid-keys`) and set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` in production `.env`. Add them to `.env.production.example` (this CAN be done in-branch — it documents config without secrets).
- `pg_dump` before deploy (zero-loss rule).
- Replace placeholder PWA icons with real brand icons if Task 7 used placeholders.
- Test real push delivery on the wife's iPhone after install (iOS 16.4+, must be installed to home screen).

---

## Global Constraints recap for reviewers (copy into each reviewer prompt)
- Additive only; NO migration this phase. No destructive SQL.
- `pushService` must no-op (not throw) when VAPID env keys are absent — at boot AND per send.
- Every notification send is best-effort: wrapped so it can never fail/delay the originating request or the reminder sweep.
- Notification pref defaults EXACTLY: assignments true, mentions true, comments false, reminders true, muteProjects [], quietHours null.
- Quiet-hours window is inclusive-start/exclusive-end and wraps midnight when start > end.
- ui/ tokens only, no hardcoded hex in components (manifest theme_color is exempt — it's OS metadata). Dates via lib/dates.
- Event names only from events catalogs (Phase 6 adds none). No Co-Authored-By. `.superpowers/` reports never committed.
- Backend tests run in the container; rebuild the test image before each run.
```
