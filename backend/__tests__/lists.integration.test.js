// backend/__tests__/lists.integration.test.js
// Integration tests for GET /api/lists — verifies the enriched SQL returns
// project_name, workspace_id, total_items, and completed_items.
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const ME    = 'lists-int-me@example.test';
const OTHER = 'lists-int-other@example.test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor   = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

describe('GET /api/lists (real DB — enriched)', () => {
  let pool;
  let meId, otherId;
  let wsId, projectId, listId;
  let item1Id, item2Id; // item1 not completed, item2 completed
  let app;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Clean up leftover rows from prior runs
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[ME, OTHER]]);

    // Create users
    meId    = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [ME])).rows[0].id;
    otherId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OTHER])).rows[0].id;

    // Create workspace + project (owned by otherId, me is a member)
    wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('LI Workspace', $1) RETURNING id", [otherId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')", [wsId, otherId]
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'member')", [wsId, meId]
    );
    projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'LI Project') RETURNING id", [wsId]
    )).rows[0].id;

    // Create a list owned by me, linked to the project
    listId = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('Venue', $1, $2) RETURNING id",
      [meId, projectId]
    )).rows[0].id;

    // Two items: one not completed, one completed
    item1Id = (await pool.query(
      "INSERT INTO list_items (list_id, text, position, completed) VALUES ($1,'Open Task',1,false) RETURNING id",
      [listId]
    )).rows[0].id;
    item2Id = (await pool.query(
      "INSERT INTO list_items (list_id, text, position, completed) VALUES ($1,'Done Task',2,true) RETURNING id",
      [listId]
    )).rows[0].id;

    // Build minimal Express app with the SAME enriched SQL as server.js GET /api/lists
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

    app.get('/api/lists', authenticateToken, async (req, res) => {
      try {
        const result = await pool.query(
          `SELECT l.*,
                  p.name AS project_name,
                  p.workspace_id AS workspace_id,
                  (SELECT COUNT(*)::int FROM list_items li WHERE li.list_id = l.id) AS total_items,
                  (SELECT COUNT(*)::int FROM list_items li WHERE li.list_id = l.id AND li.completed = true) AS completed_items,
                  CASE WHEN l.user_id = $1 THEN true ELSE false END AS is_owner,
                  CASE
                    WHEN l.user_id = $1 THEN 'owner'
                    ELSE COALESCE(ls.permission, 'view')
                  END AS user_permission
           FROM lists l
           LEFT JOIN projects p ON l.project_id = p.id
           LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $1
           WHERE l.user_id = $1 OR ls.user_id = $1
           ORDER BY l.created_at DESC`,
          [req.user.id]
        );
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lists' });
      }
    });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[ME, OTHER]]);
    await pool.end();
  });

  test('unauthenticated request → 401', async () => {
    const r = await request(app).get('/api/lists');
    expect(r.status).toBe(401);
  });

  test('returns the list with project_name and workspace_id', async () => {
    const r = await request(app)
      .get('/api/lists')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    const list = r.body.find((l) => l.id === listId);
    expect(list).toBeDefined();
    expect(list.project_name).toBe('LI Project');
    expect(list.workspace_id).toBe(wsId);
  });

  test('total_items is 2 and completed_items is 1', async () => {
    const r = await request(app)
      .get('/api/lists')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);

    const list = r.body.find((l) => l.id === listId);
    expect(list).toBeDefined();
    expect(list.total_items).toBe(2);
    expect(list.completed_items).toBe(1);
  });

  test('list with no project returns null project_name and workspace_id', async () => {
    // Create a standalone list (no project)
    const standaloneId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('Standalone', $1) RETURNING id", [meId]
    )).rows[0].id;

    const r = await request(app)
      .get('/api/lists')
      .set('Authorization', `Bearer ${tokenFor(meId, ME)}`);

    expect(r.status).toBe(200);

    const list = r.body.find((l) => l.id === standaloneId);
    expect(list).toBeDefined();
    expect(list.project_name).toBeNull();
    expect(list.workspace_id).toBeNull();

    // Clean up
    await pool.query('DELETE FROM lists WHERE id = $1', [standaloneId]);
  });
});
