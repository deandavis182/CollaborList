# CollaborList V2 — Phase 1: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the database to the V2 schema (Workspaces → Projects → Lists → Items + tags/fields/comments/activity/push) via additive, backfilling migrations that lose zero live data, and extract the DB layer into testable modules.

**Architecture:** Approach A — evolve the existing Express + `pg` + Socket.io backend in place. The existing `{name, sql}` migration runner (transactioned, name-tracked, idempotent) is reused unchanged in mechanism; we add new migration entries and extract the pool + migrations into `backend/db/` modules. No table is ever dropped or rewritten — only `CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and idempotent backfill `INSERT … WHERE NOT EXISTS` / `UPDATE … WHERE … IS NULL`.

**Tech Stack:** Node 18, Express 4.18, PostgreSQL 15, `pg` 8.11, Jest 29.7 (unit, mocked `pg`) + a new real-DB integration suite run in the docker `test` profile.

## Global Constraints

- **Zero live-data loss.** Every migration is additive/backfilling. No `DROP`, no destructive `UPDATE`/`ALTER`. Each migration runs in the existing transactioned runner (rolls back on failure; server still boots on old schema).
- **Keep existing tests green.** `backend/__tests__/cross-list-move.test.js` (10 tests, mocked `pg`) must still pass after every task.
- **Keep `RealtimeApp.jsx` and the running app working** — Phase 1 touches backend only; no API contract changes, only additive columns/tables.
- **Migration naming:** continue the existing `NNN_snake_case` scheme; next number is `003`. Names are immutable once shipped.
- **`list_shares` is preserved as-is.** Existing per-list shares keep working unchanged. The backfill does NOT convert shares into workspace membership (that would over-share a single shared list into full-workspace access). Workspace membership is a *new* collaboration path added in a later phase; per-list shares remain valid.
- **`completed` stays the source of truth** for done-state; new `status` column is backfilled from it and synced going forward (sync logic lives in a later phase, not here).
- Verify with the canonical command: `docker compose --profile test run --rm backend-test` (unit) and the new `test:integration` script (real DB).

---

## File Structure

- `backend/db/pool.js` (new) — single responsibility: construct and export the `pg.Pool` from env. Consumed by `server.js`, services, and integration tests.
- `backend/db/migrations.js` (new) — owns the `migrations` array and `runMigrations(pool)`. Exports both so tests can run migrations against any pool and inspect individual entries by name.
- `backend/server.js` (modify) — stops defining the pool and migrations inline; requires them from `db/`. Net reduction ~70 lines; behavior identical.
- `backend/__tests__/migrations.integration.test.js` (new) — real-DB test: seeds legacy rows, runs migrations, asserts the V2 schema + backfill + zero row loss + idempotency.
- `backend/jest.config.js` (modify) — exclude `*.integration.test.js` from the default unit run.
- `backend/package.json` (modify) — add `test:integration` script.
- `DEPLOYMENT.md` (modify) — add the pre-deploy `pg_dump` snapshot step (belt-and-suspenders rollback).

---

### Task 1: Extract the `pg` pool into `db/pool.js`

**Files:**
- Create: `backend/db/pool.js`
- Modify: `backend/server.js:27-34` (remove inline pool, require the module)

**Interfaces:**
- Produces: `module.exports = pool` — a `pg.Pool` instance configured from `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` env vars, with the same defaults as today (`postgres`/`5432`/`listapp`/`listuser`/`listpass`).

- [ ] **Step 1: Create the pool module**

```javascript
// backend/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'listapp',
  user: process.env.DB_USER || 'listuser',
  password: process.env.DB_PASSWORD || 'listpass'
});

module.exports = pool;
```

- [ ] **Step 2: Wire `server.js` to use it**

In `backend/server.js`, delete the inline `const pool = new Pool({ ... })` block (lines ~27-34) and the now-unused `const { Pool } = require('pg');` from the top imports. Add near the other requires:

```javascript
const pool = require('./db/pool');
```

- [ ] **Step 3: Verify existing unit tests still pass**

Run: `docker compose --profile test run --rm backend-test`
Expected: `Tests: 10 passed, 10 total` (the test mocks `pg.Pool`, so extraction is transparent).

- [ ] **Step 4: Commit**

```bash
git add backend/db/pool.js backend/server.js
git commit -m "refactor: extract pg pool into db/pool.js"
```

---

### Task 2: Extract migrations into `db/migrations.js`

**Files:**
- Create: `backend/db/migrations.js`
- Modify: `backend/server.js:879-947` (remove inline `migrations` array + `runMigrations`, require the module)

**Interfaces:**
- Consumes: `pool` from `db/pool.js`.
- Produces:
  - `migrations` — array of `{ name: string, sql: string }`.
  - `runMigrations(pool)` — async; creates the `migrations` tracking table if absent, then applies each unapplied migration inside a transaction (rollback on error, continue past failures), tracking applied names. Accepts the pool as an argument (defaults to the shared pool) so tests can pass their own.

- [ ] **Step 1: Create the migrations module (move existing 001/002 verbatim)**

```javascript
// backend/db/migrations.js
const sharedPool = require('./pool');

const migrations = [
  {
    name: '001_add_notes_column',
    sql: `ALTER TABLE list_items ADD COLUMN IF NOT EXISTS notes TEXT`
  },
  {
    name: '002_add_parent_id_column',
    sql: `
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_list_items_parent_id ON list_items(parent_id);
      CREATE INDEX IF NOT EXISTS idx_list_items_list_parent ON list_items(list_id, parent_id);
    `
  },
];

async function runMigrations(pool = sharedPool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const migration of migrations) {
      const result = await pool.query(
        'SELECT name FROM migrations WHERE name = $1',
        [migration.name]
      );
      if (result.rows.length === 0) {
        console.log(`Applying migration: ${migration.name}`);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(migration.sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
          await client.query('COMMIT');
          console.log(`✅ Migration ${migration.name} applied successfully`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Failed to apply migration ${migration.name}:`, err.message);
        } finally {
          client.release();
        }
      }
    }
    console.log('All migrations checked/applied');
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

module.exports = { migrations, runMigrations };
```

- [ ] **Step 2: Wire `server.js` to use it**

In `backend/server.js`, delete the inline `const migrations = [ ... ]` array and the entire `async function runMigrations() { ... }` (lines ~879-947). Add near the other requires:

```javascript
const { runMigrations } = require('./db/migrations');
```

The existing call site inside `initializeDatabase()` — `await runMigrations();` — now resolves to the imported function (uses the shared pool by default). Leave it unchanged.

- [ ] **Step 3: Verify existing unit tests still pass**

Run: `docker compose --profile test run --rm backend-test`
Expected: `Tests: 10 passed, 10 total`.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations.js backend/server.js
git commit -m "refactor: extract migrations into db/migrations.js with injectable pool"
```

---

### Task 3: Set up the real-DB integration test harness

**Files:**
- Create: `backend/__tests__/migrations.integration.test.js`
- Modify: `backend/jest.config.js`, `backend/package.json`

**Interfaces:**
- Consumes: `runMigrations`, `migrations` from `db/migrations.js`; a real `pg.Pool` from env (the docker `test` profile provides `DB_HOST=postgres`, healthy `listapp-db`).
- Produces: a reusable seeded-user fixture pattern (`SEED_EMAIL`) used by Tasks 4 and 5.

- [ ] **Step 1: Exclude integration tests from the default unit run**

```javascript
// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.js$'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
```

- [ ] **Step 2: Add the integration script**

In `backend/package.json` `scripts`, add:

```json
"test:integration": "jest --runInBand --testPathPattern=\"integration\\.test\\.js$\" --testPathIgnorePatterns=\"/node_modules/\""
```

> Note: a CLI `--testMatch` does **not** override `testPathIgnorePatterns` from `jest.config.js`, so it would silently find no tests. Use `--testPathPattern` (to select the integration files) plus an explicit `--testPathIgnorePatterns` that drops the integration-exclusion (keeping only `/node_modules/`).

- [ ] **Step 3: Write the harness test (real DB, NOT mocked)**

This file must NOT call `jest.mock('pg')` — it uses a real connection. It seeds a uniquely-named user + list + items, so it never collides with other data in the shared volume.

```javascript
// backend/__tests__/migrations.integration.test.js
const { Pool } = require('pg');
const { runMigrations, migrations } = require('../db/migrations');

const SEED_EMAIL = 'phase1-seed@example.test';

describe('V2 migrations (real DB)', () => {
  let pool;
  let userId;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp',
      user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Base tables exist in the test DB via docker-entrypoint init scripts.
    // Clean any prior seed for this email so the run is deterministic.
    await pool.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);

    // Seed a legacy user + list + items (pre-V2 shape).
    const u = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [SEED_EMAIL]
    );
    userId = u.rows[0].id;
    const l = await pool.query(
      'INSERT INTO lists (name, user_id) VALUES ($1, $2) RETURNING id',
      ['Legacy List', userId]
    );
    const listId = l.rows[0].id;
    await pool.query(
      'INSERT INTO list_items (list_id, text, completed) VALUES ($1, $2, $3), ($1, $4, $5)',
      [listId, 'done item', true, 'open item', false]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);
    await pool.end();
  });

  test('runMigrations applies without throwing and creates the tracking table', async () => {
    await runMigrations(pool);
    const t = await pool.query("SELECT to_regclass('public.migrations') AS reg");
    expect(t.rows[0].reg).toBe('migrations');
  });
});
```

- [ ] **Step 4: Run the integration test (will pass — only 001/002 exist yet)**

Run: `docker compose --profile test run --rm backend-test npm run test:integration`
Expected: `Tests: 1 passed`. (This proves the harness connects to the real DB and runs migrations.)

- [ ] **Step 5: Commit**

```bash
git add backend/__tests__/migrations.integration.test.js backend/jest.config.js backend/package.json
git commit -m "test: add real-DB migration integration harness"
```

---

### Task 4: Add the V2 additive schema migrations (003–011)

**Files:**
- Modify: `backend/db/migrations.js` (append entries 003–011 to the `migrations` array)
- Modify: `backend/__tests__/migrations.integration.test.js` (add schema assertions)

**Interfaces:**
- Produces: new tables `workspaces`, `workspace_members`, `projects`, `tags`, `item_tags`, `field_defs`, `item_fields`, `comments`, `activity`, `push_subscriptions`, `notification_prefs`; new `lists.project_id`; new `list_items.assignee_id`, `due_date`, `status`, `reminder_sent`. These are the schema later phases consume.

- [ ] **Step 1: Write the failing schema assertion**

Add to `migrations.integration.test.js` inside the `describe`:

```javascript
test('V2 tables and columns exist after migration', async () => {
  await runMigrations(pool);

  const tables = ['workspaces', 'workspace_members', 'projects', 'tags',
    'item_tags', 'field_defs', 'item_fields', 'comments', 'activity',
    'push_subscriptions', 'notification_prefs'];
  for (const t of tables) {
    const r = await pool.query("SELECT to_regclass($1) AS reg", [`public.${t}`]);
    expect(r.rows[0].reg).toBe(t);
  }

  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'list_items'
  `);
  const names = cols.rows.map(r => r.column_name);
  expect(names).toEqual(expect.arrayContaining(['assignee_id', 'due_date', 'status', 'reminder_sent']));

  const lcols = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'lists'
  `);
  expect(lcols.rows.map(r => r.column_name)).toContain('project_id');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose --profile test run --rm backend-test npm run test:integration`
Expected: FAIL — `expect(received).toBe('workspaces')` receives `null` (tables don't exist yet).

- [ ] **Step 3: Append migrations 003–011**

Insert these entries into the `migrations` array in `backend/db/migrations.js`, after `002_add_parent_id_column`:

```javascript
  {
    name: '003_create_workspaces',
    sql: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);
    `
  },
  {
    name: '004_create_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20),
        wedding_date DATE,
        archived BOOLEAN DEFAULT FALSE,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
    `
  },
  {
    name: '005_add_list_project_id',
    sql: `
      ALTER TABLE lists ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_lists_project ON lists(project_id);
    `
  },
  {
    name: '006_create_tags',
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS item_tags (
        item_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
      );
    `
  },
  {
    name: '007_create_fields',
    sql: `
      CREATE TABLE IF NOT EXISTS field_defs (
        id SERIAL PRIMARY KEY,
        list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        label VARCHAR(255),
        config JSONB DEFAULT '{}'::jsonb,
        position INTEGER DEFAULT 0,
        UNIQUE(list_id, key)
      );
      CREATE TABLE IF NOT EXISTS item_fields (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        value JSONB,
        UNIQUE(item_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_item_fields_item ON item_fields(item_id);
    `
  },
  {
    name: '008_create_comments',
    sql: `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_id);
    `
  },
  {
    name: '009_create_activity',
    sql: `
      CREATE TABLE IF NOT EXISTS activity (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        verb VARCHAR(50) NOT NULL,
        target JSONB,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity(workspace_id, created_at DESC);
    `
  },
  {
    name: '010_create_push_and_prefs',
    sql: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        keys JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(endpoint)
      );
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        prefs JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `
  },
  {
    name: '011_add_item_collab_columns',
    sql: `
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS status VARCHAR(20);
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_list_items_assignee ON list_items(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_list_items_due ON list_items(due_date);
    `
  },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `docker compose --profile test run --rm backend-test npm run test:integration`
Expected: PASS (schema assertions green).

- [ ] **Step 5: Verify the unit suite is still green**

Run: `docker compose --profile test run --rm backend-test`
Expected: `Tests: 10 passed, 10 total`.

- [ ] **Step 6: Commit**

```bash
git add backend/db/migrations.js backend/__tests__/migrations.integration.test.js
git commit -m "feat: add V2 additive schema migrations (003-011)"
```

---

### Task 5: Add the zero-loss backfill migration (012)

**Files:**
- Modify: `backend/db/migrations.js` (append entry 012)
- Modify: `backend/__tests__/migrations.integration.test.js` (assert backfill + zero-loss + idempotency)

**Interfaces:**
- Consumes: tables/columns from Task 4; the seeded user/list/items from the Task 3 harness.
- Produces: every pre-existing user has a `Personal` workspace (owner membership) containing a `General` project; every pre-existing list has `project_id` set to its owner's `General` project; every `list_items.status` is backfilled from `completed`. **No rows deleted.**

> **Note for later phases:** this migration only backfills *pre-existing* users. The registration flow (a later phase) must create a `Personal` workspace + `General` project for each *new* user at signup. Flagged here so it isn't missed.

- [ ] **Step 1: Write the failing backfill assertions**

Add to `migrations.integration.test.js`:

```javascript
test('backfill creates Personal workspace, General project, links list, sets status — losslessly', async () => {
  const beforeUsers = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  const beforeItems = await pool.query('SELECT COUNT(*)::int AS n FROM list_items');

  await runMigrations(pool);

  // Personal workspace owned by the seeded user
  const ws = await pool.query(
    "SELECT id FROM workspaces WHERE owner_id = $1 AND name = 'Personal'", [userId]
  );
  expect(ws.rows).toHaveLength(1);
  const wsId = ws.rows[0].id;

  // Owner membership
  const mem = await pool.query(
    "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    [wsId, userId]
  );
  expect(mem.rows[0].role).toBe('owner');

  // General project in that workspace
  const proj = await pool.query(
    "SELECT id FROM projects WHERE workspace_id = $1 AND name = 'General'", [wsId]
  );
  expect(proj.rows).toHaveLength(1);

  // The seeded list is linked to that project
  const linked = await pool.query(
    'SELECT project_id FROM lists WHERE user_id = $1', [userId]
  );
  expect(linked.rows[0].project_id).toBe(proj.rows[0].id);

  // status backfilled from completed for the seeded items
  const statuses = await pool.query(`
    SELECT li.completed, li.status FROM list_items li
    JOIN lists l ON l.id = li.list_id WHERE l.user_id = $1 ORDER BY li.completed
  `, [userId]);
  const map = Object.fromEntries(statuses.rows.map(r => [String(r.completed), r.status]));
  expect(map['true']).toBe('Done');
  expect(map['false']).toBe('To do');

  // ZERO LOSS: no users or items were removed
  const afterUsers = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  const afterItems = await pool.query('SELECT COUNT(*)::int AS n FROM list_items');
  expect(afterUsers.rows[0].n).toBeGreaterThanOrEqual(beforeUsers.rows[0].n);
  expect(afterItems.rows[0].n).toBe(beforeItems.rows[0].n);
});

test('backfill is idempotent — re-running the 012 SQL makes no duplicates', async () => {
  await runMigrations(pool);
  const sql = migrations.find(m => m.name === '012_backfill_workspaces_projects').sql;
  // Run the raw backfill SQL again directly (runMigrations is name-gated and won't re-run it)
  await pool.query(sql);
  const ws = await pool.query(
    "SELECT COUNT(*)::int AS n FROM workspaces WHERE owner_id = $1 AND name = 'Personal'", [userId]
  );
  expect(ws.rows[0].n).toBe(1);
  const proj = await pool.query(`
    SELECT COUNT(*)::int AS n FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
    WHERE w.owner_id = $1 AND p.name = 'General'`, [userId]);
  expect(proj.rows[0].n).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose --profile test run --rm backend-test npm run test:integration`
Expected: FAIL — `expect(ws.rows).toHaveLength(1)` receives length 0 (no backfill yet).

- [ ] **Step 3: Append migration 012**

Add to the `migrations` array in `backend/db/migrations.js`, after `011_add_item_collab_columns`:

```javascript
  {
    name: '012_backfill_workspaces_projects',
    sql: `
      -- 1. A "Personal" workspace for every user who doesn't own one yet
      INSERT INTO workspaces (name, owner_id)
      SELECT 'Personal', u.id FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM workspaces w WHERE w.owner_id = u.id AND w.name = 'Personal'
      );

      -- 2. Owner membership for every workspace owner
      INSERT INTO workspace_members (workspace_id, user_id, role)
      SELECT w.id, w.owner_id, 'owner' FROM workspaces w
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_members m
        WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
      );

      -- 3. A "General" project in each Personal workspace
      INSERT INTO projects (workspace_id, name)
      SELECT w.id, 'General' FROM workspaces w
      WHERE w.name = 'Personal'
        AND NOT EXISTS (
          SELECT 1 FROM projects p WHERE p.workspace_id = w.id AND p.name = 'General'
        );

      -- 4. Attach each orphan list to its owner's General project
      UPDATE lists l SET project_id = p.id
      FROM workspaces w
      JOIN projects p ON p.workspace_id = w.id AND p.name = 'General'
      WHERE w.owner_id = l.user_id AND l.project_id IS NULL;

      -- 5. Backfill status from completed (only where unset)
      UPDATE list_items SET status = CASE WHEN completed THEN 'Done' ELSE 'To do' END
      WHERE status IS NULL;
    `
  },
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose --profile test run --rm backend-test npm run test:integration`
Expected: PASS (backfill + zero-loss + idempotency assertions green).

- [ ] **Step 5: Verify the unit suite is still green**

Run: `docker compose --profile test run --rm backend-test`
Expected: `Tests: 10 passed, 10 total`.

- [ ] **Step 6: Commit**

```bash
git add backend/db/migrations.js backend/__tests__/migrations.integration.test.js
git commit -m "feat: add zero-loss backfill migration (012) with idempotency tests"
```

---

### Task 6: Document the pre-deploy snapshot (belt-and-suspenders rollback)

**Files:**
- Modify: `DEPLOYMENT.md`

- [ ] **Step 1: Add a "V2 migration safety" subsection**

Append to `DEPLOYMENT.md`:

```markdown
## V2 Migration Safety

The V2 schema migrations (003–012) are additive and backfilling — they never
drop or rewrite data, and each runs in a transaction that rolls back on failure.
As a belt-and-suspenders rollback, snapshot the database immediately before
deploying a release that introduces new migrations:

```bash
docker exec listapp-db pg_dump -U listuser listapp > backup-$(date +%Y%m%d-%H%M%S).sql
```

To restore if needed:

```bash
cat backup-YYYYMMDD-HHMMSS.sql | docker exec -i listapp-db psql -U listuser listapp
```
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: document pre-deploy pg_dump snapshot for V2 migrations"
```

---

## Self-Review

**1. Spec coverage (Phase 1 scope only):** §4 data model — all new tables (workspaces, workspace_members, projects, tags, item_tags, field_defs, item_fields, comments, activity, push_subscriptions, notification_prefs) created in Task 4; `lists.project_id` + `list_items` collab columns in Task 4; the 5-step backfill sequence in Task 5; `completed`/`status` coexistence backfilled in Task 5 step 3. Zero-loss guarantee tested in Task 5 (row-count assertions) and documented in Task 6. The DB-layer extraction (`db/pool.js`, `db/migrations.js`) prepares the backend restructure that Phase 2's route/service split builds on. **One intentional deviation from spec §4 step 4:** `list_shares` is preserved unchanged rather than converted to workspace membership (over-share risk) — documented in Global Constraints; the new workspace-membership sharing path is a Phase 2/3 concern.

**2. Placeholder scan:** No TBD/TODO/"handle appropriately" — all SQL and test code is concrete and complete.

**3. Type consistency:** `runMigrations(pool)` signature consistent across Tasks 2–5; `migrations` array shape `{name, sql}` consistent; the integration test references `migrations.find(m => m.name === '012_backfill_workspaces_projects')` matching the exact name defined in Task 5; table/column names in assertions (Task 4/5) match the DDL exactly.

**Gaps deferred to later-phase plans (by design):** registration creating default workspace for *new* users (Phase 2); `status`↔`completed` write-time sync (Phase 3/collaboration); all API/route/service/frontend work.
