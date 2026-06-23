// backend/__tests__/project-items.integration.test.js
// Integration tests for:
//   A. GET /api/lists/:listId/items — items include `tags` array
//   B. GET /api/projects/:id/items — roll-up across project's lists, with tags + list_name
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const OWNER_EMAIL = 'proj-items-owner@example.test';
const MEMBER_EMAIL = 'proj-items-member@example.test';
const NON_MEMBER_EMAIL = 'proj-items-nonmember@example.test';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Project items roll-up + list-items tags (real DB)', () => {
  let pool;
  let ownerId, memberId, nonMemberId;
  let wsId, projectId, listId1, listId2;
  let ownerToken, memberToken, nonMemberToken;
  let tagId;
  let itemInList1, itemInList2Tagged;
  let app;

  const tokenFor = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp',
      user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Cleanup leftovers
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [
      [OWNER_EMAIL, MEMBER_EMAIL, NON_MEMBER_EMAIL],
    ]);

    // Create users
    ownerId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [OWNER_EMAIL]
    )).rows[0].id;

    memberId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [MEMBER_EMAIL]
    )).rows[0].id;

    nonMemberId = (await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [NON_MEMBER_EMAIL]
    )).rows[0].id;

    // Create workspace + memberships
    wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('ProjItems WS', $1) RETURNING id",
      [ownerId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
      [wsId, ownerId]
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')",
      [wsId, memberId]
    );

    // Create project
    projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1, 'Items Project') RETURNING id",
      [wsId]
    )).rows[0].id;

    // Create two lists in the project
    listId1 = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('List Alpha', $1, $2) RETURNING id",
      [ownerId, projectId]
    )).rows[0].id;

    listId2 = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('List Beta', $1, $2) RETURNING id",
      [ownerId, projectId]
    )).rows[0].id;

    // Create a tag in the workspace
    tagId = (await pool.query(
      "INSERT INTO tags (workspace_id, name, color) VALUES ($1, 'urgent', '#f00') RETURNING id",
      [wsId]
    )).rows[0].id;

    // Create items: one in list1 (no tags), one in list2 (tagged)
    itemInList1 = (await pool.query(
      "INSERT INTO list_items (list_id, text, position) VALUES ($1, 'Item in Alpha', 1) RETURNING id",
      [listId1]
    )).rows[0].id;

    itemInList2Tagged = (await pool.query(
      "INSERT INTO list_items (list_id, text, position) VALUES ($1, 'Item in Beta', 1) RETURNING id",
      [listId2]
    )).rows[0].id;

    // Tag the item in list2
    await pool.query(
      'INSERT INTO item_tags (item_id, tag_id) VALUES ($1, $2)',
      [itemInList2Tagged, tagId]
    );

    ownerToken = tokenFor(ownerId, OWNER_EMAIL);
    memberToken = tokenFor(memberId, MEMBER_EMAIL);
    nonMemberToken = tokenFor(nonMemberId, NON_MEMBER_EMAIL);

    // Build minimal express app mounting the real projects router
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
    const sanitize = (s) => (s || '').toString();

    app = express();
    app.use(express.json());
    app.use('/api/projects', require('../routes/projects')(authenticateToken, sanitize));

    // Also mount a minimal list-items GET handler that mirrors server.js with tags
    app.get('/api/lists/:listId/items', authenticateToken, async (req, res) => {
      const { listId } = req.params;
      try {
        const accessCheck = await pool.query(
          `SELECT 1 FROM lists l
           LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
           WHERE l.id = $1 AND (l.user_id = $2 OR ls.user_id = $2)`,
          [listId, req.user.id]
        );
        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Not authorized' });
        }
        const result = await pool.query(
          `SELECT li.*, COALESCE(
             (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
              FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = li.id),
             '[]'::json
           ) AS tags
           FROM list_items li
           WHERE li.list_id = $1
           ORDER BY li.position, li.created_at`,
          [listId]
        );
        res.json(result.rows);
      } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
      }
    });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [
      [OWNER_EMAIL, MEMBER_EMAIL, NON_MEMBER_EMAIL],
    ]);
    await pool.end();
  });

  // ─── Part A: list-items tags shape ─────────────────────────────────────────

  describe('GET /api/lists/:listId/items — tags array', () => {
    test('untagged item has tags: [] (empty array)', async () => {
      const r = await request(app)
        .get(`/api/lists/${listId1}/items`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
      const item = r.body.find((i) => i.id === itemInList1);
      expect(item).toBeDefined();
      expect(item.tags).toEqual([]);
    });

    test('tagged item returns tags:[{id,name,color}]', async () => {
      const r = await request(app)
        .get(`/api/lists/${listId2}/items`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(r.status).toBe(200);
      const item = r.body.find((i) => i.id === itemInList2Tagged);
      expect(item).toBeDefined();
      expect(Array.isArray(item.tags)).toBe(true);
      expect(item.tags).toHaveLength(1);
      expect(item.tags[0]).toMatchObject({ id: tagId, name: 'urgent', color: '#f00' });
    });
  });

  // ─── Part B: GET /api/projects/:id/items ───────────────────────────────────

  describe('GET /api/projects/:id/items', () => {
    test('owner gets items from BOTH lists with list_name', async () => {
      const r = await request(app)
        .get(`/api/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);

      const ids = r.body.map((i) => i.id);
      expect(ids).toContain(itemInList1);
      expect(ids).toContain(itemInList2Tagged);

      // Each item has list_name
      const alpha = r.body.find((i) => i.id === itemInList1);
      expect(alpha.list_name).toBe('List Alpha');

      const beta = r.body.find((i) => i.id === itemInList2Tagged);
      expect(beta.list_name).toBe('List Beta');
    });

    test('workspace member gets items → 200', async () => {
      const r = await request(app)
        .get(`/api/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(r.status).toBe(200);
    });

    test('non-member gets 403', async () => {
      const r = await request(app)
        .get(`/api/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${nonMemberToken}`);
      expect(r.status).toBe(403);
    });

    test('tagged item has tags:[{id,name,color}] in roll-up', async () => {
      const r = await request(app)
        .get(`/api/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(r.status).toBe(200);
      const beta = r.body.find((i) => i.id === itemInList2Tagged);
      expect(Array.isArray(beta.tags)).toBe(true);
      expect(beta.tags).toHaveLength(1);
      expect(beta.tags[0]).toMatchObject({ id: tagId, name: 'urgent', color: '#f00' });
    });

    test('untagged item has tags:[] in roll-up', async () => {
      const r = await request(app)
        .get(`/api/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(r.status).toBe(200);
      const alpha = r.body.find((i) => i.id === itemInList1);
      expect(alpha.tags).toEqual([]);
    });

    test('unauthenticated → 401', async () => {
      const r = await request(app).get(`/api/projects/${projectId}/items`);
      expect(r.status).toBe(401);
    });
  });
});
