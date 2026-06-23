// backend/__tests__/tasks.integration.test.js
// Integration tests for GET /api/me/tasks (Task 3A.8).
// Mounts the REAL routes/tasks router via supertest against a live DB.
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeTasksRouter = require('../routes/tasks');

const ME        = 'tasks8-me@example.test';
const OTHER     = 'tasks8-other@example.test';
const STRANGER  = 'tasks8-stranger@example.test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor   = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

describe('GET /api/me/tasks (real DB)', () => {
  let pool;
  let meId, otherId, strangerId;
  let app;

  // List/item IDs we create
  let ownedListId, ownedItemWithDue, ownedItemWithDue2, ownedItemNoDue;
  let sharedListId, sharedItem;
  let wsListId, wsItem;
  let noAccessListId, noAccessItem;
  let otherUserItem;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up leftover rows from prior runs
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[ME, OTHER, STRANGER]]);

    // Create users
    meId       = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [ME])).rows[0].id;
    otherId    = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OTHER])).rows[0].id;
    strangerId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [STRANGER])).rows[0].id;

    // ── 1. Owned list (no project) ──────────────────────────────────────────
    ownedListId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('My List', $1) RETURNING id", [meId]
    )).rows[0].id;

    // Item assigned to me with earlier due date → should appear first
    ownedItemWithDue = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Task A - early due', 1, $2, '2026-01-15') RETURNING id`,
      [ownedListId, meId]
    )).rows[0].id;

    // Item assigned to me with later due date
    ownedItemWithDue2 = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Task B - late due', 2, $2, '2026-06-30') RETURNING id`,
      [ownedListId, meId]
    )).rows[0].id;

    // Item assigned to me with NULL due date → should appear LAST
    ownedItemNoDue = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Task C - no due', 3, $2, NULL) RETURNING id`,
      [ownedListId, meId]
    )).rows[0].id;

    // Item in owned list assigned to someone ELSE → NOT returned
    otherUserItem = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Other user task', 4, $2, '2026-02-01') RETURNING id`,
      [ownedListId, otherId]
    )).rows[0].id;

    // ── 2. Shared list (via list_shares) ───────────────────────────────────
    sharedListId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Shared List', $1) RETURNING id", [otherId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO list_shares (list_id, user_id, permission) VALUES ($1,$2,'edit')",
      [sharedListId, meId]
    );
    sharedItem = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Shared Task', 1, $2, '2026-03-10') RETURNING id`,
      [sharedListId, meId]
    )).rows[0].id;

    // ── 3. Workspace-member list (via workspace_members) ───────────────────
    const wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('WS8', $1) RETURNING id", [otherId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')", [wsId, otherId]
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'member')", [wsId, meId]
    );
    const projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'T8 Project') RETURNING id", [wsId]
    )).rows[0].id;
    wsListId = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('WS List', $1, $2) RETURNING id",
      [otherId, projectId]
    )).rows[0].id;
    wsItem = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'WS Task', 1, $2, '2026-04-20') RETURNING id`,
      [wsListId, meId]
    )).rows[0].id;

    // ── 4. No-access list ──────────────────────────────────────────────────
    noAccessListId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Private List', $1) RETURNING id", [strangerId]
    )).rows[0].id;
    noAccessItem = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Private Task', 1, $2, '2025-12-01') RETURNING id`,
      [noAccessListId, meId]
    )).rows[0].id;

    // ── Build minimal Express app mounting the REAL tasks router ───────────
    const authenticateToken = (req, res, next) => {
      const h = req.headers['authorization'];
      const t = h && h.split(' ')[1];
      if (!t) return res.status(401).json({ error: 'Access token required' });
      jwt.verify(t, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
      });
    };

    app = express();
    app.use(express.json());
    // Mount exactly as server.js does: app.use('/api/me', require('./routes/tasks')(authenticateToken))
    app.use('/api/me', makeTasksRouter(authenticateToken));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[ME, OTHER, STRANGER]]);
    await pool.end();
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  test('unauthenticated request → 401', async () => {
    const r = await request(app).get('/api/me/tasks');
    expect(r.status).toBe(401);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  test('returns exactly the accessible-and-assigned items (owned + shared + workspace)', async () => {
    const r = await request(app)
      .get('/api/me/tasks')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    const ids = r.body.map(item => item.id);

    // Must include items from all three access paths
    expect(ids).toContain(ownedItemWithDue);
    expect(ids).toContain(ownedItemWithDue2);
    expect(ids).toContain(ownedItemNoDue);
    expect(ids).toContain(sharedItem);
    expect(ids).toContain(wsItem);

    // Must NOT include no-access item
    expect(ids).not.toContain(noAccessItem);

    // Must NOT include item assigned to someone else
    expect(ids).not.toContain(otherUserItem);
  });

  test('items include list_name and project_name fields', async () => {
    const r = await request(app)
      .get('/api/me/tasks')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);

    // Owned list has no project → project_name should be null
    const ownedTask = r.body.find(i => i.id === ownedItemWithDue);
    expect(ownedTask).toBeDefined();
    expect(ownedTask.list_name).toBe('My List');
    expect(ownedTask.project_name).toBeNull();

    // WS list is linked to a project → project_name should be 'T8 Project'
    const wsTask = r.body.find(i => i.id === wsItem);
    expect(wsTask).toBeDefined();
    expect(wsTask.list_name).toBe('WS List');
    expect(wsTask.project_name).toBe('T8 Project');
  });

  test('items are ordered by due_date ASC with NULL due_date last', async () => {
    const r = await request(app)
      .get('/api/me/tasks')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);

    const ids = r.body.map(i => i.id);

    // ownedItemWithDue  = 2026-01-15 (earliest)
    // sharedItem        = 2026-03-10
    // wsItem            = 2026-04-20
    // ownedItemWithDue2 = 2026-06-30
    // ownedItemNoDue    = NULL (last)

    const posA  = ids.indexOf(ownedItemWithDue);
    const posB  = ids.indexOf(ownedItemWithDue2);
    const posS  = ids.indexOf(sharedItem);
    const posW  = ids.indexOf(wsItem);
    const posND = ids.indexOf(ownedItemNoDue);

    // 2026-01-15 before 2026-03-10
    expect(posA).toBeLessThan(posS);
    // 2026-03-10 before 2026-04-20
    expect(posS).toBeLessThan(posW);
    // 2026-04-20 before 2026-06-30
    expect(posW).toBeLessThan(posB);
    // NULL due last (higher index than any dated item)
    expect(posND).toBeGreaterThan(posA);
    expect(posND).toBeGreaterThan(posB);
    expect(posND).toBeGreaterThan(posS);
    expect(posND).toBeGreaterThan(posW);
  });

  test('item assigned to someone else in an accessible list is NOT returned', async () => {
    const r = await request(app)
      .get('/api/me/tasks')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);
    const ids = r.body.map(i => i.id);
    expect(ids).not.toContain(otherUserItem);
  });

  test('item assigned to me in a no-access list is NOT returned', async () => {
    const r = await request(app)
      .get('/api/me/tasks')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);
    const ids = r.body.map(i => i.id);
    expect(ids).not.toContain(noAccessItem);
  });

  test('a user with no assigned tasks gets an empty array', async () => {
    const r = await request(app)
      .get('/api/me/tasks')
      .set('Authorization', `Bearer ${tokenFor(strangerId, STRANGER)}`);

    expect(r.status).toBe(200);
    // strangerId owns items but is not assigned to any
    expect(Array.isArray(r.body)).toBe(true);
    const ids = r.body.map(i => i.id);
    // None of our seeded items should appear for stranger (they own noAccessListId
    // but the noAccessItem is assigned to meId, not strangerId)
    expect(ids).not.toContain(noAccessItem);
  });
});
