# Phase 7B — Recurring Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a task repeat — when a task that has a recurrence rule is completed, automatically spawn the next occurrence with its due date advanced (e.g. "pay the venue installment every month").

**Architecture:** Scope automations tightly to recurring tasks (YAGNI — no general rules engine). A recurrence rule lives on the item as two additive columns (`recur_unit` ∈ day|week|month|year, `recur_interval` integer). When an item PUT transitions the item to completed AND it carries a recurrence rule AND a due_date, the backend spawns a fresh sibling item (same text/list/parent/assignee, status "To do", not completed, recurrence copied, due_date advanced by interval×unit) and emits `item-created` so collaborators see it live. Pure date math lives in a testable helper.

**Tech Stack:** Backend `pg` + existing inline item PUT handler + emit helpers. Frontend @tanstack/react-query v5, ui/ tokens. Tests: backend Jest (pure helper + mocked-pool service + integration), frontend Vitest.

## Global Constraints

- **Branch:** `v2-phase7b-recurring` (off `main`). Do NOT switch/create other branches mid-task.
- **ADDITIVE migration only** (migration 015 adds two nullable columns via `ADD COLUMN IF NOT EXISTS`). Zero data loss; no destructive SQL.
- **The LIVE APP is the new shell at `/`** (`frontend/src/main.jsx`). Do not touch `RealtimeApp.jsx`.
- **`recur_unit` valid values EXACTLY:** `'day'`, `'week'`, `'month'`, `'year'` (or `null` to clear). `recur_interval` is a positive integer (≥1). A rule is "active" only when BOTH `recur_unit` and `recur_interval` are set AND the item has a `due_date`.
- **Spawn is best-effort** — wrapped so a spawn failure can never fail the item-update HTTP response.
- **Spawn happens once per completion transition** — only when the item goes from not-completed to completed in THIS update (prev_completed false → updatedItem.completed true). Re-saving an already-completed item must NOT spawn again.
- **Dates:** store `due_date` as the existing TIMESTAMP. Advancing: day → +N days; week → +7×N days; month → +N calendar months (JS Date month rollover acceptable, documented); year → +N years. Frontend display via `lib/dates.js`.
- **ui/ primitives + design tokens only — NO hardcoded hex.**
- **NO Co-Authored-By trailer.** `.superpowers/` reports gitignored — never commit them.
- **Backend tests run IN the container:** `docker compose --profile test build backend-test` before each run.

---

## File Structure

**Backend (new):**
- `backend/lib/recurrence.js` — pure `nextDueDate(due, unit, interval)` → Date (advances the date; never mutates input).
- `backend/services/recurrenceService.js` — `maybeSpawnNext(pool, { item, prevCompleted })` → the spawned row or null (decides + inserts the next occurrence).
- Tests: `backend/__tests__/recurrence.test.js`, `backend/__tests__/recurrenceService.test.js`, plus integration coverage in a new `backend/__tests__/recurrence-spawn.integration.test.js`.

**Backend (modified):**
- `backend/db/migrations.js` — append migration `015_add_recurrence_columns`.
- `backend/server.js` — item PUT: accept `recur_unit`/`recur_interval` in the destructure + query builder; after a completion transition in the non-cross-list path, call `recurrenceService.maybeSpawnNext` (best-effort) and emit `item-created` for the spawned row.

**Frontend (new):**
- `frontend/src/features/items/RecurrencePicker.jsx` — None / Daily / Weekly / Monthly / Yearly + an interval number input; persists via `useUpdateItem`.
- Tests: `frontend/src/features/items/__tests__/RecurrencePicker.test.jsx`.

**Frontend (modified):**
- `frontend/src/features/items/ItemDetailDrawer.jsx` — add a "Repeat" row (RecurrencePicker) near the Due date field.
- `frontend/src/features/items/ItemRow.jsx` — show a small "🔁 every N <unit>" chip when the item has a recurrence rule.

---

## Interfaces

```js
// backend lib/recurrence.js
nextDueDate(due, unit, interval) // due: Date|string|number; unit: 'day'|'week'|'month'|'year'; interval: int≥1 → Date

// backend services/recurrenceService.js
async maybeSpawnNext(pool, { item, prevCompleted })
// item = the just-updated row (has id, list_id, text, parent_id, assignee_id, due_date, completed, recur_unit, recur_interval)
// returns the inserted next-occurrence row, or null if no spawn (not a completion transition / no rule / no due_date)

// frontend
RecurrencePicker({ item }) // reads item.recur_unit/recur_interval; calls useUpdateItem(item.list_id).mutate({ id, recur_unit, recur_interval })
```

---

### Task 1: Migration `015_add_recurrence_columns`

**Files:**
- Modify: `backend/db/migrations.js` (append after `014_create_attachments`)
- Test: `backend/__tests__/migration-015.integration.test.js`

- [ ] **Step 1: Write the failing integration test**
```js
'use strict';
const pool = require('../db/pool');
const { runMigrations } = require('../db/migrations');
beforeAll(async () => { await runMigrations(); });
afterAll(async () => { await pool.end(); });

test('list_items has recur_unit and recur_interval columns', async () => {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='list_items'`);
  const cols = r.rows.map((x) => x.column_name);
  expect(cols).toContain('recur_unit');
  expect(cols).toContain('recur_interval');
});
test('migration idempotent', async () => { await expect(runMigrations()).resolves.not.toThrow(); });
test('columns default to NULL (no recurrence) for a new item', async () => {
  const u = await pool.query(`INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id`, ['recur-mig@x.com','x']);
  const l = await pool.query(`INSERT INTO lists (name,user_id) VALUES ($1,$2) RETURNING id`, ['L', u.rows[0].id]);
  const it = await pool.query(`INSERT INTO list_items (list_id,text) VALUES ($1,$2) RETURNING recur_unit, recur_interval`, [l.rows[0].id, 'i']);
  expect(it.rows[0].recur_unit).toBeNull();
  expect(it.rows[0].recur_interval).toBeNull();
  await pool.query(`DELETE FROM users WHERE id=$1`, [u.rows[0].id]);
});
```

- [ ] **Step 2: Run, expect fail** — `docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npm run test:integration -- migration-015` → FAIL.

- [ ] **Step 3: Append the migration** (after the `014_create_attachments` entry):
```js
  {
    name: '015_add_recurrence_columns',
    sql: `
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS recur_unit VARCHAR(10);
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS recur_interval INTEGER;
    `
  },
```

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit** `feat(7B.T1): migration 015 — recurrence columns on list_items (additive)`.

---

### Task 2: `lib/recurrence.js` + `recurrenceService.js`

**Files:**
- Create: `backend/lib/recurrence.js`, `backend/services/recurrenceService.js`
- Create: `backend/__tests__/recurrence.test.js`, `backend/__tests__/recurrenceService.test.js`

**Interfaces:** `nextDueDate(due, unit, interval)`; `maybeSpawnNext(pool, { item, prevCompleted })`.

- [ ] **Step 1: Write the failing `recurrence.test.js`**
```js
'use strict';
const { nextDueDate } = require('../lib/recurrence');

test('day: advances by interval days', () => {
  expect(nextDueDate('2026-06-23T00:00:00.000Z', 'day', 3).toISOString().slice(0,10)).toBe('2026-06-26');
});
test('week: advances by interval*7 days', () => {
  expect(nextDueDate('2026-06-23T00:00:00.000Z', 'week', 2).toISOString().slice(0,10)).toBe('2026-07-07');
});
test('month: advances by interval months', () => {
  expect(nextDueDate('2026-01-15T00:00:00.000Z', 'month', 1).toISOString().slice(0,10)).toBe('2026-02-15');
});
test('year: advances by interval years', () => {
  expect(nextDueDate('2026-10-17T00:00:00.000Z', 'year', 1).toISOString().slice(0,10)).toBe('2027-10-17');
});
test('does not mutate the input date', () => {
  const d = new Date('2026-06-23T00:00:00.000Z');
  nextDueDate(d, 'day', 5);
  expect(d.toISOString().slice(0,10)).toBe('2026-06-23');
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `backend/lib/recurrence.js`**
```js
'use strict';
// Advance a due date by interval units. Pure: returns a NEW Date, never mutates.
// Uses UTC component math (containers run UTC; due_date is stored as a timestamp).
function nextDueDate(due, unit, interval) {
  const d = new Date(due);
  const n = Number(interval) || 1;
  switch (unit) {
    case 'day':   d.setUTCDate(d.getUTCDate() + n); break;
    case 'week':  d.setUTCDate(d.getUTCDate() + 7 * n); break;
    case 'month': d.setUTCMonth(d.getUTCMonth() + n); break;   // JS rolls month-end over; acceptable
    case 'year':  d.setUTCFullYear(d.getUTCFullYear() + n); break;
    default: return new Date(due);
  }
  return d;
}
module.exports = { nextDueDate };
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Write the failing `recurrenceService.test.js`** (mocked pool):
```js
'use strict';
jest.mock('../lib/recurrence', () => ({ nextDueDate: jest.fn(() => new Date('2026-07-23T00:00:00.000Z')) }));
const svc = require('../services/recurrenceService');

const RULE_ITEM = { id: 5, list_id: 3, text: 'Pay installment', parent_id: null, assignee_id: 7,
  due_date: '2026-06-23T00:00:00.000Z', completed: true, recur_unit: 'month', recur_interval: 1 };

test('spawns next occurrence on completion transition', async () => {
  const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 99 }] }) };
  const row = await svc.maybeSpawnNext(pool, { item: RULE_ITEM, prevCompleted: false });
  expect(pool.query).toHaveBeenCalledTimes(1);
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/INSERT INTO list_items/);
  // new item: same list/text/parent/assignee, not completed, recurrence copied, advanced due
  expect(params).toContain(3);                 // list_id
  expect(params).toContain('Pay installment'); // text
  expect(params).toContain('month');           // recur_unit copied
  expect(row).toEqual({ id: 99 });
});
test('no spawn when already completed before (no transition)', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: RULE_ITEM, prevCompleted: true })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
test('no spawn when not completed now', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: { ...RULE_ITEM, completed: false }, prevCompleted: false })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
test('no spawn without a recurrence rule', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: { ...RULE_ITEM, recur_unit: null }, prevCompleted: false })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
test('no spawn without a due_date', async () => {
  const pool = { query: jest.fn() };
  expect(await svc.maybeSpawnNext(pool, { item: { ...RULE_ITEM, due_date: null }, prevCompleted: false })).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run, expect fail.**

- [ ] **Step 7: Implement `backend/services/recurrenceService.js`**
```js
'use strict';
const { nextDueDate } = require('../lib/recurrence');

async function maybeSpawnNext(pool, { item, prevCompleted }) {
  if (!item) return null;
  const becameCompleted = item.completed === true && prevCompleted !== true;
  if (!becameCompleted) return null;
  if (!item.recur_unit || !item.recur_interval || !item.due_date) return null;

  const due = nextDueDate(item.due_date, item.recur_unit, item.recur_interval);
  const r = await pool.query(
    `INSERT INTO list_items
       (list_id, text, parent_id, assignee_id, due_date, status, completed, recur_unit, recur_interval, position)
     VALUES ($1, $2, $3, $4, $5, 'To do', FALSE, $6, $7,
             COALESCE((SELECT MAX(position) FROM list_items WHERE list_id = $1), 0) + 1000)
     RETURNING *`,
    [item.list_id, item.text, item.parent_id, item.assignee_id, due, item.recur_unit, item.recur_interval]
  );
  return r.rows[0];
}
module.exports = { maybeSpawnNext };
```

- [ ] **Step 8: Run, expect pass.** **Step 9: Commit** `feat(7B.T2): recurrence date math + maybeSpawnNext service`.

---

### Task 3: Wire recurrence into the item PUT handler

**Files:**
- Modify: `backend/server.js` (item PUT: accept recur fields + spawn on completion)
- Create/extend: `backend/__tests__/recurrence-spawn.integration.test.js`

**Interfaces:** Consumes `recurrenceService.maybeSpawnNext`. The item PUT destructures req.body fields at `server.js:780` and builds the UPDATE query incrementally (see the existing `due_date`/`assignee_id` clauses ~935). `prev_completed` is already fetched (`server.js:828`). The non-cross-list update path (~`server.js:990-1026`) is where `updatedItem` exists and `item-updated` is emitted.

- [ ] **Step 1: Accept recur fields in the destructure** — add `recur_unit`, `recur_interval` to the `req.body` destructure in the item PUT (near line 780).

- [ ] **Step 2: Add them to the UPDATE query builder** (alongside the existing `due_date` clause):
```js
if (recur_unit !== undefined) {
  query += `, recur_unit = $${paramCount++}`;
  params.push(recur_unit);   // null clears the rule
}
if (recur_interval !== undefined) {
  query += `, recur_interval = $${paramCount++}`;
  params.push(recur_interval);
}
```

- [ ] **Step 3: Spawn on completion transition** — in the non-cross-list `else` branch, after `item-updated` is emitted, add a best-effort block:
```js
// Recurring task: spawn the next occurrence when this update completed a rule-bearing item.
try {
  const recurrenceService = require('./services/recurrenceService');
  const spawned = await recurrenceService.maybeSpawnNext(pool, { item: updatedItem, prevCompleted: prev_completed });
  if (spawned) {
    emitListUpdate(targetListId, 'item-created', { listId: targetListId, item: spawned });
  }
} catch (recurErr) {
  console.error('Recurrence spawn failed (non-fatal):', recurErr);
}
```
(`require` at top-of-file is preferred — add `const recurrenceService = require('./services/recurrenceService');` with the other requires and drop the inline require, matching the Phase 6 fix convention.)

- [ ] **Step 4: Write the integration test** (`recurrence-spawn.integration.test.js`, real DB) — create a user/list/item with `recur_unit='week'`, `recur_interval=1`, `due_date`, `completed=false`; run the same UPDATE-then-spawn flow the handler performs (or call `recurrenceService.maybeSpawnNext` directly against the real DB after marking completed) and assert a NEW not-completed item exists with due_date advanced 7 days and the recurrence copied; assert re-running with prevCompleted=true spawns nothing. Clean up.

- [ ] **Step 5: Run** — `... npm run test:integration -- recurrence-spawn` + `... npx jest cross-list-move` (item PUT path unbroken) + `... npm test` (unit green). **Step 6: Commit** `feat(7B.T3): wire recurrence spawn into item update + accept recur fields`.

---

### Task 4: Frontend RecurrencePicker + drawer + row badge

**Files:**
- Create: `frontend/src/features/items/RecurrencePicker.jsx`, `frontend/src/features/items/__tests__/RecurrencePicker.test.jsx`
- Modify: `frontend/src/features/items/ItemDetailDrawer.jsx` (Repeat row), `frontend/src/features/items/ItemRow.jsx` (recurrence chip)

- [ ] **Step 1: Write `RecurrencePicker.test.jsx`** — mock `../../lib/api`: renders a unit select (None/Daily/Weekly/Monthly/Yearly) reflecting `item.recur_unit`; choosing "Weekly" calls `useUpdateItem(item.list_id).mutate({ id: item.id, recur_unit: 'week', recur_interval: 1 })`; an interval input updates `recur_interval`; choosing "None" calls mutate with `recur_unit: null, recur_interval: null`. testids `recurrence-picker`, `recurrence-unit`, `recurrence-interval`.

- [ ] **Step 2: Implement `RecurrencePicker.jsx`** — a `ui/` select mapping labels→units (`{None:null, Daily:'day', Weekly:'week', Monthly:'month', Yearly:'year'}`) + a number input (min 1) for interval (shown only when a unit is selected); onChange persists via `useUpdateItem(item.list_id).mutate({ id: item.id, recur_unit, recur_interval })`. Default interval 1. ui/ tokens only.

- [ ] **Step 3: Wire into `ItemDetailDrawer.jsx`** — add a "Repeat" `<Field label="Repeat">` rendering `<RecurrencePicker item={item} />` right after the Due date field. Only when `item` exists.

- [ ] **Step 4: Row badge in `ItemRow.jsx`** — when `item.recur_unit && item.recur_interval`, render a small `ui/Chip` like `🔁 every {interval} {unit}{interval>1?'s':''}` (e.g. "🔁 every 1 week"). testid `item-recur-${item.id}`. Add after the due-date chip.

- [ ] **Step 5: Extend tests** — RecurrencePicker test (above); add an ItemRow test asserting the recur chip shows when recurrence is set and is absent otherwise.

- [ ] **Step 6: Run** — `cd frontend && npm test` (full green) + `cd frontend && npm run build`. **Step 7: Commit** `feat(7B.T4): recurrence picker in drawer + recurrence chip on rows`.

---

### Task 5: Live Playwright E2E (recurrence round-trip)

**Files:** none committed (verification). Document in report.

- [ ] **Step 1:** Rebuild + restart backend + frontend containers on the branch; health check.
- [ ] **Step 2:** Live Playwright against `/`: open an item, set a due date, set Repeat = Weekly (interval 1); verify the row shows the recurrence chip. Mark the item complete; verify a NEW not-completed item appears with the due date advanced 7 days and the recurrence chip carried over (refetch the list / check via the API). Screenshot.
- [ ] **Step 3:** Fix any runtime bugs (`fix(7B.T5): ...`). Document results.

---

## Self-review
- Spec coverage: automations/recurring tasks → Tasks 1-5. General rules engine explicitly OUT (YAGNI, documented). Attachments were Phase 7A.
- Zero-loss: additive migration 015 (two nullable columns) only.
- Safety: spawn is best-effort + once-per-transition; recurrence math pure-tested; item PUT path covered by cross-list-move staying green.
