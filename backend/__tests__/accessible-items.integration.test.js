// backend/__tests__/accessible-items.integration.test.js
// Integration tests for GET /api/me/items (accessibleForUser).
// Mounts the REAL routes/tasks router via supertest against a live DB.
// NOTE: Only runs in CI/Docker where DB is available — npm test excludes integration tests.
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeTasksRouter = require('../routes/tasks');

const USER_A    = 'items-int-a@example.test';
const USER_B    = 'items-int-b@example.test';
const STRANGER  = 'items-int-stranger@example.test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor   = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

describe('GET /api/me/items (real DB)', () => {
  let pool;
  let userAId, userBId, strangerId;
  let app;

  let wsItemId;
  let noAccessItemId;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up leftover rows from prior runs
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[USER_A, USER_B, STRANGER]]);

    // Create users
    userAId    = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [USER_A])).rows[0].id;
    userBId    = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [USER_B])).rows[0].id;
    strangerId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [STRANGER])).rows[0].id;

    // ── Workspace with userA (owner) and userB (member) ────────────────────
    const wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('Items-Int WS', $1) RETURNING id", [userAId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')", [wsId, userAId]
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'member')", [wsId, userBId]
    );

    // Project + list owned by userA in the workspace
    const projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'Items-Int Project') RETURNING id", [wsId]
    )).rows[0].id;
    const wsListId = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('Items-Int List', $1, $2) RETURNING id",
      [userAId, projectId]
    )).rows[0].id;

    // Item assigned to userB (NOT userA) — broadened search should find this for userA
    wsItemId = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'UserB assigned task', 1, $2, '2026-05-01') RETURNING id`,
      [wsListId, userBId]
    )).rows[0].id;

    // ── No-access list owned by stranger ───────────────────────────────────
    const noAccessListId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Private Stranger List', $1) RETURNING id", [strangerId]
    )).rows[0].id;
    noAccessItemId = (await pool.query(
      `INSERT INTO list_items (list_id, text, position, assignee_id, due_date)
       VALUES ($1, 'Stranger private task', 1, $2, '2026-06-01') RETURNING id`,
      [noAccessListId, userAId]
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
    app.use('/api/me', makeTasksRouter(authenticateToken));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[USER_A, USER_B, STRANGER]]);
    await pool.end();
  });

  test('unauthenticated request → 401', async () => {
    const r = await request(app).get('/api/me/items');
    expect(r.status).toBe(401);
  });

  test('returns item assigned to userB when called as userA (broadened search)', async () => {
    const r = await request(app)
      .get('/api/me/items')
      .set('Authorization', `Bearer ${tokenFor(userAId, USER_A)}`);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    const ids = r.body.map(item => item.id);
    expect(ids).toContain(wsItemId);
  });

  test('item assigned to userB carries assignee_email equal to userB email', async () => {
    const r = await request(app)
      .get('/api/me/items')
      .set('Authorization', `Bearer ${tokenFor(userAId, USER_A)}`);

    expect(r.status).toBe(200);

    const item = r.body.find(i => i.id === wsItemId);
    expect(item).toBeDefined();
    expect(item.assignee_email).toBe(USER_B);
  });

  test('item in a no-access list is NOT returned (access boundary preserved)', async () => {
    const r = await request(app)
      .get('/api/me/items')
      .set('Authorization', `Bearer ${tokenFor(userAId, USER_A)}`);

    expect(r.status).toBe(200);

    const ids = r.body.map(i => i.id);
    expect(ids).not.toContain(noAccessItemId);
  });
});
