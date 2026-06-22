# CollaborList V2 — Phase 2A: Hub Backend APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read the roadmap first: `docs/superpowers/plans/2026-06-22-collaborlist-v2-roadmap.md`.

**Goal:** Expose the V2 hub data model (created in Phase 1) through REST + real-time APIs — workspaces & membership, projects, tags, list↔project assignment — and provision a Personal workspace for every new user, while keeping the existing app fully functional.

**Architecture:** Approach A, evolving the existing Express app. Phase 1 left a thin `db/` layer; this phase begins the `routes/` + `services/` + `middleware/` restructure by adding the NEW resources in the target structure (`routes/<resource>.js` → `services/<resource>Service.js`), mounted in `server.js`. Existing list/item routes stay in `server.js`; we touch them only to add `project_id`. New collaboration sharing rides workspace membership; the existing per-list `list_shares` path is preserved untouched.

**Tech Stack:** Node 18, Express 4.18, PostgreSQL 15 (`pg` 8.11, raw parameterized SQL), Socket.io 4.6, JWT auth, Jest 29.7 (unit, mocked pg) + the Phase 1 real-DB integration suite (`*.integration.test.js`).

## Global Constraints

- **Keep the existing app working.** The current endpoints (`GET/POST/PUT/DELETE /api/lists`, items, shares, auth) keep their existing contracts. `GET /api/lists` must still return every accessible list. The frontend (`RealtimeApp.jsx`) is untouched this phase.
- **Existing unit suite stays green:** `docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test` → `Tests: 10 passed, 10 total`.
- **Real-DB integration tests** for new endpoints: `docker compose --profile test run --rm backend-test npm run test:integration`. ALWAYS `docker compose --profile test build backend-test` first (the test image bakes code via `COPY . .`, no volume mount). Verify migration-dependent tests on two consecutive runs.
- **No `Co-Authored-By` trailer** in commit messages (user rule).
- **Parameterized SQL only** (no string interpolation into SQL). Reuse `sanitizeInput` from `security.js` for user-supplied names/text, matching the existing list routes.
- **Permissions:** workspace roles are `owner | admin | member`. Create/rename/delete a workspace's projects & tags requires ≥ member; managing members or deleting the workspace requires owner (admin may add members). Access to a workspace = a row in `workspace_members` for that user. The list/item permission model (owner/edit/view via `list_shares`) is unchanged.
- **Provisioning rule (carry-forward #2):** every NEW user (email register AND google signup) gets a `Personal` workspace + `General` project + `owner` membership, created in one transaction.
- **Linking rule (carry-forward #1):** when linking a list to a project, resolve the project explicitly (by id, validated against the user's workspace) — never "any workspace the user owns."

## File Structure

- `backend/middleware/permissions.js` (new) — workspace access/role assertions used by route handlers.
- `backend/services/workspaceService.js` (new) — workspace + membership SQL/logic, incl. `provisionNewUser`.
- `backend/services/projectService.js` (new) — project SQL/logic.
- `backend/services/tagService.js` (new) — tag + item-tag SQL/logic.
- `backend/routes/workspaces.js` (new) — `/api/workspaces` router (CRUD + members + nested projects/tags).
- `backend/routes/projects.js` (new) — `/api/projects/:id` router (update/delete + nested lists).
- `backend/server.js` (modify) — mount the new routers; call `provisionNewUser` from register + google; add `project_id` to list create/update + responses; add `GET /api/projects/:id/lists`; join `workspace-{id}` socket rooms; add `emitWorkspaceUpdate`.
- `backend/__tests__/hub.integration.test.js` (new) — real-DB integration tests for the new APIs.
- `DEPLOYMENT.md`, design spec (modify) — carry-forwards #4, #5.

> Note on auth in routes: the existing `authenticateToken` middleware is defined in `server.js`. Export it so routers can use it. In Task 1, add `module.exports.authenticateToken = authenticateToken;` is not possible (server.js isn't required by routers). Instead, **pass `authenticateToken` into each router via a factory**: `routes/workspaces.js` exports `module.exports = (authenticateToken) => { const router = express.Router(); ...; return router; }`, and `server.js` mounts `app.use('/api/workspaces', require('./routes/workspaces')(authenticateToken))`. Same pattern for `projects.js`.

---

### Task 1: Permissions middleware + workspace role helper

**Files:**
- Create: `backend/middleware/permissions.js`
- Create/extend: `backend/__tests__/hub.integration.test.js` (harness + first tests)

**Interfaces:**
- Produces:
  - `getWorkspaceRole(pool, workspaceId, userId): Promise<'owner'|'admin'|'member'|null>` — null if no membership.
  - `requireWorkspaceRole(pool, minRole)` → Express middleware that 403s unless `req.user.id` has ≥ `minRole` in `req.params.workspaceId` (or `req.workspaceId` if set by a prior step). Role order: `member < admin < owner`. Sets `req.workspaceRole`.

- [ ] **Step 1: Write the failing test** (in `hub.integration.test.js`). Seed two users + a workspace owned by user A with A as owner member; assert `getWorkspaceRole` returns `'owner'` for A and `null` for B.

```javascript
// backend/__tests__/hub.integration.test.js
const { Pool } = require('pg');
const { getWorkspaceRole } = require('../middleware/permissions');

const A = 'phase2-a@example.test';
const B = 'phase2-b@example.test';

describe('Hub backend (real DB)', () => {
  let pool, aId, bId, wsId;
  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres', port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp', user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[A, B]]);
    aId = (await pool.query("INSERT INTO users (email, password_hash) VALUES ($1,'x') RETURNING id", [A])).rows[0].id;
    bId = (await pool.query("INSERT INTO users (email, password_hash) VALUES ($1,'x') RETURNING id", [B])).rows[0].id;
    wsId = (await pool.query('INSERT INTO workspaces (name, owner_id) VALUES ($1,$2) RETURNING id', ['WS', aId])).rows[0].id;
    await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')", [wsId, aId]);
  });
  afterAll(async () => { await pool.query('DELETE FROM users WHERE email = ANY($1)', [[A, B]]); await pool.end(); });

  test('getWorkspaceRole returns role for member, null for non-member', async () => {
    expect(await getWorkspaceRole(pool, wsId, aId)).toBe('owner');
    expect(await getWorkspaceRole(pool, wsId, bId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail** (`getWorkspaceRole` not defined). `docker compose --profile test build backend-test && docker compose --profile test run --rm backend-test npm run test:integration`.

- [ ] **Step 3: Implement `backend/middleware/permissions.js`**

```javascript
const ROLE_ORDER = { member: 1, admin: 2, owner: 3 };

async function getWorkspaceRole(pool, workspaceId, userId) {
  const r = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return r.rows.length ? r.rows[0].role : null;
}

function requireWorkspaceRole(pool, minRole) {
  return async (req, res, next) => {
    try {
      const workspaceId = req.workspaceId || req.params.workspaceId;
      if (!workspaceId) return res.status(400).json({ error: 'Workspace id required' });
      const role = await getWorkspaceRole(pool, workspaceId, req.user.id);
      if (!role || ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
        return res.status(403).json({ error: 'Insufficient workspace permission' });
      }
      req.workspaceRole = role;
      req.workspaceId = workspaceId;
      next();
    } catch (e) {
      console.error('Permission check error:', e);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = { getWorkspaceRole, requireWorkspaceRole, ROLE_ORDER };
```

- [ ] **Step 4: Run → pass.** Then commit: `git commit -m "feat: add workspace permissions middleware"`.

---

### Task 2: Workspace service + routes (CRUD + membership)

**Files:**
- Create: `backend/services/workspaceService.js`, `backend/routes/workspaces.js`
- Modify: `backend/server.js` (mount router), `backend/__tests__/hub.integration.test.js`

**Interfaces:**
- `workspaceService`:
  - `listForUser(pool, userId)` → workspaces the user is a member of, each with their `role`.
  - `create(pool, userId, name)` → inserts workspace (owner_id=userId) + owner membership in a transaction; returns the workspace row.
  - `rename(pool, workspaceId, name)` → returns updated row.
  - `remove(pool, workspaceId)` → deletes workspace (CASCADE handles members/projects).
  - `listMembers(pool, workspaceId)` → rows of `{user_id, email, role}`.
  - `addMemberByEmail(pool, workspaceId, email, role)` → finds user by email, upserts membership; returns `{user_id, email, role}`; throws `{code:'NO_USER'}` if email not found.
  - `removeMember(pool, workspaceId, userId)`.
- `routes/workspaces.js` (factory taking `authenticateToken`): mounts
  - `GET /` → `listForUser`
  - `POST /` (body `{name}`) → `create`
  - `PUT /:workspaceId` (≥ admin) → `rename`
  - `DELETE /:workspaceId` (owner) → `remove`
  - `GET /:workspaceId/members` (≥ member) → `listMembers`
  - `POST /:workspaceId/members` (≥ admin; body `{email, role}`) → `addMemberByEmail`
  - `DELETE /:workspaceId/members/:userId` (owner) → `removeMember`

- [ ] **Step 1: Write failing tests** — append to `hub.integration.test.js`: create-workspace returns a row with owner membership; addMemberByEmail adds B as member; listForUser for B includes the workspace with role `member`; addMemberByEmail with unknown email throws NO_USER.

```javascript
const ws = require('../services/workspaceService');
test('create + addMember + listForUser', async () => {
  const w = await ws.create(pool, aId, 'Trip');
  expect(w.owner_id).toBe(aId);
  expect(await getWorkspaceRole(pool, w.id, aId)).toBe('owner');
  const m = await ws.addMemberByEmail(pool, w.id, B, 'member');
  expect(m.user_id).toBe(bId);
  const forB = await ws.listForUser(pool, bId);
  expect(forB.find(x => x.id === w.id).role).toBe('member');
  await expect(ws.addMemberByEmail(pool, w.id, 'nope@x.test', 'member'))
    .rejects.toMatchObject({ code: 'NO_USER' });
});
```

- [ ] **Step 2: Run → fail.** (build + integration run)

- [ ] **Step 3: Implement `backend/services/workspaceService.js`**

```javascript
async function listForUser(pool, userId) {
  const r = await pool.query(
    `SELECT w.*, m.role FROM workspaces w
     JOIN workspace_members m ON m.workspace_id = w.id
     WHERE m.user_id = $1 ORDER BY w.created_at`, [userId]);
  return r.rows;
}

async function create(pool, userId, name) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1,$2) RETURNING *', [name, userId]);
    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')",
      [w.rows[0].id, userId]);
    await client.query('COMMIT');
    return { ...w.rows[0], role: 'owner' };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function rename(pool, workspaceId, name) {
  const r = await pool.query('UPDATE workspaces SET name=$1 WHERE id=$2 RETURNING *', [name, workspaceId]);
  return r.rows[0];
}

async function remove(pool, workspaceId) {
  await pool.query('DELETE FROM workspaces WHERE id=$1', [workspaceId]);
}

async function listMembers(pool, workspaceId) {
  const r = await pool.query(
    `SELECT m.user_id, u.email, m.role FROM workspace_members m
     JOIN users u ON u.id = m.user_id WHERE m.workspace_id=$1 ORDER BY m.role`, [workspaceId]);
  return r.rows;
}

async function addMemberByEmail(pool, workspaceId, email, role) {
  const u = await pool.query('SELECT id, email FROM users WHERE email=$1', [email]);
  if (!u.rows.length) { const e = new Error('No such user'); e.code = 'NO_USER'; throw e; }
  const userId = u.rows[0].id;
  const safeRole = ['member', 'admin'].includes(role) ? role : 'member';
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [workspaceId, userId, safeRole]);
  return { user_id: userId, email: u.rows[0].email, role: safeRole };
}

async function removeMember(pool, workspaceId, userId) {
  await pool.query('DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [workspaceId, userId]);
}

// Provisioning for new users — Personal workspace + General project + owner membership (one txn).
async function provisionNewUser(pool, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('Personal',$1) RETURNING id", [userId]);
    const wsId = w.rows[0].id;
    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')", [wsId, userId]);
    await client.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'General')", [wsId]);
    await client.query('COMMIT');
    return wsId;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

module.exports = { listForUser, create, rename, remove, listMembers, addMemberByEmail, removeMember, provisionNewUser };
```

- [ ] **Step 4: Implement `backend/routes/workspaces.js`**

```javascript
const express = require('express');
const pool = require('../db/pool');
const svc = require('../services/workspaceService');
const { requireWorkspaceRole } = require('../middleware/permissions');
const { sanitizeInput } = require('../security').createSecurityMiddleware
  ? {} : {}; // NOTE: sanitizeInput is created in server.js; see Step 5 wiring note.

module.exports = (authenticateToken, sanitize) => {
  const router = express.Router();
  router.use(authenticateToken);

  router.get('/', async (req, res) => {
    try { res.json(await svc.listForUser(pool, req.user.id)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch workspaces' }); }
  });

  router.post('/', async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Workspace name required' });
    try { res.status(201).json(await svc.create(pool, req.user.id, name)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create workspace' }); }
  });

  router.put('/:workspaceId', requireWorkspaceRole(pool, 'admin'), async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Workspace name required' });
    try { res.json(await svc.rename(pool, req.params.workspaceId, name)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update workspace' }); }
  });

  router.delete('/:workspaceId', requireWorkspaceRole(pool, 'owner'), async (req, res) => {
    try { await svc.remove(pool, req.params.workspaceId); res.json({ success: true }); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete workspace' }); }
  });

  router.get('/:workspaceId/members', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try { res.json(await svc.listMembers(pool, req.params.workspaceId)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch members' }); }
  });

  router.post('/:workspaceId/members', requireWorkspaceRole(pool, 'admin'), async (req, res) => {
    try { res.status(201).json(await svc.addMemberByEmail(pool, req.params.workspaceId, req.body.email, req.body.role)); }
    catch (e) {
      if (e.code === 'NO_USER') return res.status(404).json({ error: 'No user with that email' });
      console.error(e); res.status(500).json({ error: 'Failed to add member' });
    }
  });

  router.delete('/:workspaceId/members/:userId', requireWorkspaceRole(pool, 'owner'), async (req, res) => {
    try { await svc.removeMember(pool, req.params.workspaceId, req.params.userId); res.json({ success: true }); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to remove member' }); }
  });

  return router;
};
```

- [ ] **Step 5: Wire into `server.js`.** `sanitizeInput` is returned from `createSecurityMiddleware(...)` (server.js:38). Remove the broken `require('../security')...` line at the top of `routes/workspaces.js` (it was a placeholder) — the router receives `sanitize` as its second factory arg instead. Mount after the existing routes:

```javascript
app.use('/api/workspaces', require('./routes/workspaces')(authenticateToken, sanitizeInput));
```

- [ ] **Step 6: Run integration + unit suites → both green** (build first). Commit: `git commit -m "feat: workspace CRUD and membership API"`.

---

### Task 3: Project service + routes

**Files:**
- Create: `backend/services/projectService.js`, `backend/routes/projects.js`
- Modify: `backend/routes/workspaces.js` (nested `GET`/`POST /:workspaceId/projects`), `backend/server.js` (mount `projects` router), `backend/__tests__/hub.integration.test.js`

**Interfaces:**
- `projectService`:
  - `listForWorkspace(pool, workspaceId)` → projects ordered by `position, created_at`.
  - `create(pool, workspaceId, {name, color, wedding_date})` → row.
  - `getWorkspaceIdForProject(pool, projectId)` → workspaceId or null (used by permission checks on `/api/projects/:id`).
  - `update(pool, projectId, {name, color, wedding_date, archived, position})` → row (only provided fields).
  - `remove(pool, projectId)`.
- Routes: nested under workspaces for list/create (workspace-scoped, ≥ member); top-level `/api/projects/:id` for update/delete (permission resolved via the project's workspace).

- [ ] **Step 1: Failing tests** — create project in a workspace; list shows it; update sets wedding_date; non-member (user B) gets 403 creating in A's workspace (HTTP-level via supertest against the mounted app — see Task 6 for the supertest app pattern, or assert at the service+permission layer here). Minimal service-level test:

```javascript
const proj = require('../services/projectService');
test('project create/list/update', async () => {
  const w = await ws.create(pool, aId, 'Wedding');
  const p = await proj.create(pool, w.id, { name: 'Vendors' });
  expect((await proj.listForWorkspace(pool, w.id)).some(x => x.id === p.id)).toBe(true);
  const u = await proj.update(pool, p.id, { wedding_date: '2026-10-15' });
  expect(u.wedding_date.toISOString().slice(0,10)).toBe('2026-10-15');
  expect(await proj.getWorkspaceIdForProject(pool, p.id)).toBe(w.id);
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `projectService.js`**

```javascript
async function listForWorkspace(pool, workspaceId) {
  const r = await pool.query(
    'SELECT * FROM projects WHERE workspace_id=$1 ORDER BY position, created_at', [workspaceId]);
  return r.rows;
}
async function create(pool, workspaceId, { name, color = null, wedding_date = null }) {
  const r = await pool.query(
    'INSERT INTO projects (workspace_id, name, color, wedding_date) VALUES ($1,$2,$3,$4) RETURNING *',
    [workspaceId, name, color, wedding_date]);
  return r.rows[0];
}
async function getWorkspaceIdForProject(pool, projectId) {
  const r = await pool.query('SELECT workspace_id FROM projects WHERE id=$1', [projectId]);
  return r.rows.length ? r.rows[0].workspace_id : null;
}
async function update(pool, projectId, fields) {
  const allowed = ['name', 'color', 'wedding_date', 'archived', 'position'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in fields && fields[k] !== undefined) { vals.push(fields[k]); sets.push(`${k}=$${vals.length}`); }
  if (!sets.length) { const r = await pool.query('SELECT * FROM projects WHERE id=$1', [projectId]); return r.rows[0]; }
  vals.push(projectId);
  const r = await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
  return r.rows[0];
}
async function remove(pool, projectId) { await pool.query('DELETE FROM projects WHERE id=$1', [projectId]); }
module.exports = { listForWorkspace, create, getWorkspaceIdForProject, update, remove };
```

- [ ] **Step 4: Add nested project routes to `routes/workspaces.js`** (inside the factory, before `return router`):

```javascript
  const proj = require('../services/projectService');
  router.get('/:workspaceId/projects', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try { res.json(await proj.listForWorkspace(pool, req.params.workspaceId)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch projects' }); }
  });
  router.post('/:workspaceId/projects', requireWorkspaceRole(pool, 'member'), async (req, res) => {
    const name = sanitize(req.body.name);
    if (!name) return res.status(400).json({ error: 'Project name required' });
    try { res.status(201).json(await proj.create(pool, req.params.workspaceId, { name, color: req.body.color || null, wedding_date: req.body.wedding_date || null })); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create project' }); }
  });
```

- [ ] **Step 5: Implement `routes/projects.js`** (update/delete; permission via the project's workspace using `req.workspaceId`):

```javascript
const express = require('express');
const pool = require('../db/pool');
const proj = require('../services/projectService');
const { requireWorkspaceRole } = require('../middleware/permissions');

module.exports = (authenticateToken, sanitize) => {
  const router = express.Router();
  router.use(authenticateToken);

  // Resolve the workspace for permission checks on a project id.
  async function attachWorkspace(req, res, next) {
    const wsId = await proj.getWorkspaceIdForProject(pool, req.params.id);
    if (!wsId) return res.status(404).json({ error: 'Project not found' });
    req.workspaceId = wsId; next();
  }

  router.put('/:id', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    const fields = { ...req.body };
    if ('name' in fields) fields.name = sanitize(fields.name);
    try { res.json(await proj.update(pool, req.params.id, fields)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update project' }); }
  });

  router.delete('/:id', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try { await proj.remove(pool, req.params.id); res.json({ success: true }); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete project' }); }
  });

  return router;
};
```

- [ ] **Step 6: Mount in `server.js`:** `app.use('/api/projects', require('./routes/projects')(authenticateToken, sanitizeInput));`

- [ ] **Step 7: Run both suites → green** (build first). Commit: `git commit -m "feat: project CRUD API (workspace-scoped)"`.

---

### Task 4: Provision new users on signup

**Files:**
- Modify: `backend/server.js` (register + google handlers), `backend/__tests__/hub.integration.test.js`

**Interfaces:**
- Consumes: `workspaceService.provisionNewUser(pool, userId)` (defined in Task 2).

- [ ] **Step 1: Failing test** — call `provisionNewUser` for a fresh user; assert exactly one `Personal` workspace (owner membership) + one `General` project; re-calling does NOT duplicate is NOT required (provision runs once per signup), but assert a second call creates a *second* Personal workspace would be wrong — so the test asserts a single call yields exactly one of each:

```javascript
test('provisionNewUser creates Personal ws + General project + owner membership', async () => {
  const email = 'phase2-new@example.test';
  await pool.query('DELETE FROM users WHERE email=$1', [email]);
  const id = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id",[email])).rows[0].id;
  await ws.provisionNewUser(pool, id);
  const w = await pool.query("SELECT id FROM workspaces WHERE owner_id=$1 AND name='Personal'", [id]);
  expect(w.rows).toHaveLength(1);
  expect(await getWorkspaceRole(pool, w.rows[0].id, id)).toBe('owner');
  const p = await pool.query("SELECT id FROM projects WHERE workspace_id=$1 AND name='General'", [w.rows[0].id]);
  expect(p.rows).toHaveLength(1);
  await pool.query('DELETE FROM users WHERE email=$1', [email]);
});
```

- [ ] **Step 2: Run → fail** (if `provisionNewUser` not yet exercised) / confirm green if Task 2 already added it — then proceed to wiring.

- [ ] **Step 3: Wire into `server.js` register handler** (after the user INSERT at ~line 172, before issuing the token):

```javascript
    const user = result.rows[0];
    try { await require('./services/workspaceService').provisionNewUser(pool, user.id); }
    catch (e) { console.error('Failed to provision workspace for new user:', e); }
```

Add the same `provisionNewUser` call in the `/api/auth/google` handler immediately after a NEW google user is inserted (only when the user is newly created, not on existing-user login). Locate the user-insert in that handler and guard provisioning to the new-user branch.

- [ ] **Step 4: Run both suites → green** (build first). Commit: `git commit -m "feat: provision Personal workspace for new users on signup"`.

---

### Task 5: Link lists to projects

**Files:**
- Modify: `backend/server.js` (`POST /api/lists`, `PUT /api/lists/:id`, `GET /api/lists`; add `GET /api/projects/:id/lists`), `backend/__tests__/hub.integration.test.js`

**Interfaces:**
- `POST /api/lists` accepts optional `project_id`; validates the caller is a member of that project's workspace before assigning (carry-forward #1). `PUT /api/lists/:id` accepts optional `project_id` (same validation, or `null` to unassign). `GET /api/lists` responses include `project_id`. New `GET /api/projects/:id/lists` returns lists in a project (≥ member of its workspace).

- [ ] **Step 1: Failing tests** — create a list with `project_id` set to a project in the user's workspace → list row has that `project_id`; `GET /api/projects/:id/lists` returns it; creating a list with a `project_id` in a workspace the user is NOT a member of → 403.

```javascript
const request = require('supertest');
// Build a minimal app mounting the lists routes is heavy; prefer asserting via service/SQL +
// the projects router for the 403. If you mount a supertest app, reuse the pattern from Task 6.
test('list can be linked to a project the user belongs to', async () => {
  const w = await ws.create(pool, aId, 'Home');
  const p = await proj.create(pool, w.id, { name: 'Chores' });
  const l = (await pool.query(
    'INSERT INTO lists (name, user_id, project_id) VALUES ($1,$2,$3) RETURNING *',
    ['Kitchen', aId, p.id])).rows[0];
  expect(l.project_id).toBe(p.id);
});
```

- [ ] **Step 2: Run → fail / establish baseline.**

- [ ] **Step 3: Update `POST /api/lists` (server.js ~297).** After validating `name`, validate optional `project_id`:

```javascript
  let { name, description, project_id } = req.body;
  name = sanitizeInput(name);
  description = sanitizeInput(description || '');
  if (!name || name.length < 1) return res.status(400).json({ error: 'List name is required' });

  if (project_id) {
    const { getWorkspaceIdForProject } = require('./services/projectService');
    const { getWorkspaceRole } = require('./middleware/permissions');
    const wsId = await getWorkspaceIdForProject(pool, project_id);
    if (!wsId || !(await getWorkspaceRole(pool, wsId, req.user.id))) {
      return res.status(403).json({ error: 'No access to that project' });
    }
  }
  const result = await pool.query(
    'INSERT INTO lists (name, description, user_id, project_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, description, req.user.id, project_id || null]);
```

- [ ] **Step 4: Update `PUT /api/lists/:id`** to accept `project_id` with the same validation (allow `null` to unassign), and ensure `GET /api/lists` already returns `l.*` (it does — `project_id` is included automatically). Add `GET /api/projects/:id/lists` to `routes/projects.js`:

```javascript
  router.get('/:id/lists', attachWorkspace, requireWorkspaceRole(pool, 'member'), async (req, res) => {
    try { const r = await pool.query('SELECT * FROM lists WHERE project_id=$1 ORDER BY created_at DESC', [req.params.id]); res.json(r.rows); }
    catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch project lists' }); }
  });
```

- [ ] **Step 5: Run both suites → green; confirm `GET /api/lists` still returns all accessible lists (existing behavior) and the 10 unit tests still pass.** Commit: `git commit -m "feat: link lists to projects with workspace-membership validation"`.

---

### Task 6: Tags service + routes + item tagging

**Files:**
- Create: `backend/services/tagService.js`
- Modify: `backend/routes/workspaces.js` (nested tags), `backend/server.js` (item tag endpoints), `backend/__tests__/hub.integration.test.js`

**Interfaces:**
- `tagService`: `listForWorkspace(pool, wsId)`; `create(pool, wsId, {name,color})`; `remove(pool, tagId)`; `tagsForWorkspaceIdOfTag(pool, tagId)`; `addToItem(pool, itemId, tagId)`; `removeFromItem(pool, itemId, tagId)`; `listForItem(pool, itemId)`.
- Routes: `GET/POST /api/workspaces/:workspaceId/tags` (≥ member); `DELETE /api/tags/:id` (resolve workspace, ≥ member) — add a tiny `routes/tags.js` OR fold delete into workspaces router as `/:workspaceId/tags/:tagId`. Item tagging: `POST /api/items/:id/tags` (body `{tag_id}`) and `DELETE /api/items/:id/tags/:tagId` in server.js, validating the caller owns/has-edit on the item's list (reuse the item permission pattern already in `PUT /api/items/:id`).

- [ ] **Step 1: Failing tests** — create a tag in a workspace; add it to a seeded item; `listForItem` returns it; remove it.

```javascript
const tags = require('../services/tagService');
test('tag create + attach to item + list + remove', async () => {
  const w = await ws.create(pool, aId, 'TagWS');
  const t = await tags.create(pool, w.id, { name: 'urgent', color: '#f00' });
  const list = (await pool.query('INSERT INTO lists (name,user_id) VALUES ($1,$2) RETURNING id',['L',aId])).rows[0];
  const item = (await pool.query('INSERT INTO list_items (list_id,text) VALUES ($1,$2) RETURNING id',[list.id,'x'])).rows[0];
  await tags.addToItem(pool, item.id, t.id);
  expect((await tags.listForItem(pool, item.id)).some(x => x.id === t.id)).toBe(true);
  await tags.removeFromItem(pool, item.id, t.id);
  expect(await tags.listForItem(pool, item.id)).toHaveLength(0);
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `tagService.js`**

```javascript
async function listForWorkspace(pool, wsId) {
  return (await pool.query('SELECT * FROM tags WHERE workspace_id=$1 ORDER BY name', [wsId])).rows;
}
async function create(pool, wsId, { name, color = null }) {
  return (await pool.query('INSERT INTO tags (workspace_id,name,color) VALUES ($1,$2,$3) RETURNING *', [wsId, name, color])).rows[0];
}
async function remove(pool, tagId) { await pool.query('DELETE FROM tags WHERE id=$1', [tagId]); }
async function workspaceIdOfTag(pool, tagId) {
  const r = await pool.query('SELECT workspace_id FROM tags WHERE id=$1', [tagId]);
  return r.rows.length ? r.rows[0].workspace_id : null;
}
async function addToItem(pool, itemId, tagId) {
  await pool.query('INSERT INTO item_tags (item_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [itemId, tagId]);
}
async function removeFromItem(pool, itemId, tagId) {
  await pool.query('DELETE FROM item_tags WHERE item_id=$1 AND tag_id=$2', [itemId, tagId]);
}
async function listForItem(pool, itemId) {
  return (await pool.query(
    'SELECT t.* FROM tags t JOIN item_tags it ON it.tag_id=t.id WHERE it.item_id=$1 ORDER BY t.name', [itemId])).rows;
}
module.exports = { listForWorkspace, create, remove, workspaceIdOfTag, addToItem, removeFromItem, listForItem };
```

- [ ] **Step 4: Add nested tag routes to `routes/workspaces.js`** (`GET`/`POST /:workspaceId/tags` ≥ member; `DELETE /:workspaceId/tags/:tagId` ≥ member). Add item-tag endpoints to `server.js` reusing the item-access check from `PUT /api/items/:id` (verify the caller owns or has edit access to the item's list before tagging).

- [ ] **Step 5: Run both suites → green** (build first). Commit: `git commit -m "feat: tags API and item tagging"`.

---

### Task 7: Socket workspace rooms

**Files:**
- Modify: `backend/server.js` (connection handler + emit helper), `backend/__tests__/hub.integration.test.js` (optional: assert the membership query used to join rooms)

**Interfaces:**
- On socket connect, in addition to list rooms, join `workspace-{id}` for every workspace the user is a member of. Add `emitWorkspaceUpdate(workspaceId, event, data)` mirroring `emitListUpdate`.

- [ ] **Step 1: Implement** — in the `io.on('connection')` handler (server.js ~52), after joining list rooms, add:

```javascript
    const wsRooms = await pool.query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = $1', [socket.userId]);
    for (const row of wsRooms.rows) socket.join(`workspace-${row.workspace_id}`);
```

And near `emitListUpdate` (server.js ~91):

```javascript
const emitWorkspaceUpdate = (workspaceId, event, data) => {
  io.to(`workspace-${workspaceId}`).emit(event, data);
};
```

Emit `workspace-updated` / `member-added` / `member-removed` from the relevant workspace routes (pass `emitWorkspaceUpdate` into the workspaces router factory as a third arg, or require a small `realtime/emit.js` later — for now, wire via factory arg).

- [ ] **Step 2: Verify** the server boots and existing socket behavior is unaffected (run the unit suite; manually confirm no errors in `docker compose logs backend` if running locally). Commit: `git commit -m "feat: join workspace socket rooms and add workspace emit helper"`.

---

### Task 8: Documentation carry-forwards

**Files:**
- Modify: `DEPLOYMENT.md` (carry-forward #4), `docs/superpowers/specs/2026-06-22-collaborlist-v2-design.md` (carry-forward #5)

- [ ] **Step 1:** In `DEPLOYMENT.md` "V2 Migration Safety", add a line: the integration suite (`npm run test:integration`) seeds/mutates the database and must run against a dedicated test database (e.g. a separate `DB_NAME`), never production.
- [ ] **Step 2:** In the design spec §4, update step 4 wording so it states `list_shares` is PRESERVED unchanged (not converted to workspace membership), matching shipped behavior; note workspace membership is the new, additional sharing path.
- [ ] **Step 3:** Commit: `git commit -m "docs: integration-test DB warning and list_shares preservation note"`.

---

## Self-Review

**1. Spec coverage (Phase 2A scope):** workspaces CRUD + membership (Task 2), projects CRUD (Task 3), new-user provisioning (Task 4, carry-forward #2), list↔project linking with membership validation (Task 5, carry-forward #1), tags + item tagging (Task 6), workspace socket rooms (Task 7), doc carry-forwards #4/#5 (Task 8). The frontend shell + hub UI are Phase 2B/2C (separate plans, per the roadmap).

**2. Placeholder scan:** All handlers and SQL are concrete. The one stub to delete is called out explicitly in Task 2 Step 5 (the bogus `require('../security')...` line in the first draft of `routes/workspaces.js` — the router takes `sanitize` as a factory arg instead).

**3. Type/interface consistency:** `requireWorkspaceRole(pool, minRole)` and `getWorkspaceRole(pool, wsId, userId)` signatures are used consistently across Tasks 1–6; router factories uniformly take `(authenticateToken, sanitize)` (Task 7 adds an emit arg to the workspaces factory — update the mount in server.js accordingly); `provisionNewUser(pool, userId)` defined in Task 2, consumed in Task 4; `getWorkspaceIdForProject`/`workspaceIdOfTag` used for permission resolution on top-level `/api/projects/:id` and `/api/tags`.

**Carry-forwards honored:** #1 (Task 5 validates project membership explicitly), #2 (Task 4), #4 (Task 8), #5 (Task 8). #3 (status NULL handling) belongs to Phase 3 and is out of scope here.

**Deferred to Phase 2B/2C and beyond:** all frontend work; converting existing list/item routes fully into `routes/`+`services/` (done incrementally as touched); assignments/comments/activity/presence (Phase 3).
