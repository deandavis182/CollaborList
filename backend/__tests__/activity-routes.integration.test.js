'use strict';
// backend/__tests__/activity-routes.integration.test.js
// Integration tests for routes/activity.js.
// Mounts the REAL activity router against a real DB (like hub.integration.test.js).

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeActivityRouter = require('../routes/activity');

const OWNER      = 'act7-owner@example.test';
const NON_MEMBER = 'act7-nonmember@example.test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor   = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

// Passthrough sanitize (mirrors server.js sanitizeInput for test purposes)
const sanitize = (s) => (s == null ? '' : String(s)).replace(/[<>"'`;(){}[\]\\]/g, '').slice(0, 1000);

// No-op emit stubs — we verify DB side-effects, not socket traffic
const emit = { list: jest.fn(), workspace: jest.fn() };

// Real authenticateToken mirror (same logic as server.js)
function makeAuthMiddleware() {
  return (req, res, next) => {
    const h = req.headers['authorization'];
    const t = h && h.split(' ')[1];
    if (!t) return res.status(401).json({ error: 'Access token required' });
    jwt.verify(t, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  };
}

describe('Activity routes (real DB)', () => {
  let pool;
  let ownerId, nonMemberId;
  let wsId;
  let activityId1, activityId2;
  let app;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up any leftover rows from prior runs
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, NON_MEMBER]]);

    // Create users
    ownerId = (await pool.query(
      "INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER]
    )).rows[0].id;
    nonMemberId = (await pool.query(
      "INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [NON_MEMBER]
    )).rows[0].id;

    // Create workspace and make owner a member
    wsId = (await pool.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1,$2) RETURNING id',
      ['ACT7 WS', ownerId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')",
      [wsId, ownerId]
    );

    // Insert activity rows for this workspace (newest first by default order)
    // Ensure ordering by inserting with small delay or different created_at values
    const r1 = await pool.query(
      `INSERT INTO activity (workspace_id, actor_id, verb, target, meta)
       VALUES ($1,$2,'item.created','{}','{}') RETURNING id`,
      [wsId, ownerId]
    );
    activityId1 = r1.rows[0].id;

    const r2 = await pool.query(
      `INSERT INTO activity (workspace_id, actor_id, verb, target, meta)
       VALUES ($1,$2,'item.completed','{}','{}') RETURNING id`,
      [wsId, ownerId]
    );
    activityId2 = r2.rows[0].id;

    // Build the test app
    const authenticateToken = makeAuthMiddleware();
    app = express();
    app.use(express.json());
    app.use('/api/activity', makeActivityRouter(authenticateToken, sanitize, emit));
  });

  afterAll(async () => {
    // Cascade deletes: deleting workspace removes activity rows; deleting users removes members
    await pool.query('DELETE FROM workspaces WHERE id=$1', [wsId]);
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, NON_MEMBER]]);
    await pool.end();
  });

  // -------------------------------------------------------------------------
  // GET /api/activity/workspace/:workspaceId — member access
  // -------------------------------------------------------------------------

  test('GET as member returns 200 with items array newest-first and unread count', async () => {
    const r = await request(app)
      .get(`/api/activity/workspace/${wsId}`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
    // Should have at least the 2 rows we inserted
    expect(r.body.items.length).toBeGreaterThanOrEqual(2);
    // Newest-first: higher id last-inserted should appear before lower id
    const ids = r.body.items.map(x => x.id);
    const idx1 = ids.indexOf(activityId1);
    const idx2 = ids.indexOf(activityId2);
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
    // activityId2 was inserted after activityId1, so it should appear first (lower index)
    expect(idx2).toBeLessThan(idx1);

    // unread: last_seen_activity is NULL for this new member → all rows are unread
    expect(typeof r.body.unread).toBe('number');
    expect(r.body.unread).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // POST /api/activity/workspace/:workspaceId/read — marks read
  // -------------------------------------------------------------------------

  test('POST /read as member returns 200 success; subsequent GET shows unread = 0', async () => {
    const markR = await request(app)
      .post(`/api/activity/workspace/${wsId}/read`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

    expect(markR.status).toBe(200);
    expect(markR.body.success).toBe(true);

    // A tiny pause to ensure last_seen_activity > all our rows' created_at
    await new Promise(r => setTimeout(r, 10));

    const getR = await request(app)
      .get(`/api/activity/workspace/${wsId}`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);

    expect(getR.status).toBe(200);
    expect(getR.body.unread).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Non-member gets 403
  // -------------------------------------------------------------------------

  test('GET as non-member returns 403', async () => {
    const r = await request(app)
      .get(`/api/activity/workspace/${wsId}`)
      .set('Authorization', `Bearer ${tokenFor(nonMemberId, NON_MEMBER)}`);

    expect(r.status).toBe(403);
  });

  test('POST /read as non-member returns 403', async () => {
    const r = await request(app)
      .post(`/api/activity/workspace/${wsId}/read`)
      .set('Authorization', `Bearer ${tokenFor(nonMemberId, NON_MEMBER)}`);

    expect(r.status).toBe(403);
  });
});
