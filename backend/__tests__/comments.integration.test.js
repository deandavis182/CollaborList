// backend/__tests__/comments.integration.test.js
// Integration tests for comments router (Task 3A.5).
// Mounts the REAL routes/comments factory with a real DB.
'use strict';

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeCommentsRouter = require('../routes/comments');
const events = require('../realtime/events');

// Unique email prefixes to avoid cross-suite collisions
const OWNER  = 'c5-owner@example.test';
const VIEWER = 'c5-viewer@example.test';
const EDITOR = 'c5-editor@example.test';
const WS_MEM = 'c5-wsmember@example.test'; // separate workspace member for @mention tests

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor  = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

// Passthrough sanitize (mirrors server.js sanitizeInput for test purposes)
const sanitize = (s) => (s == null ? '' : String(s)).replace(/[<>"'`;(){}[\]\\]/g, '').slice(0, 1000);

// No-op emit stubs — we verify DB side-effects, not socket traffic
const emit = { list: jest.fn(), workspace: jest.fn() };

describe('Comments router (real DB)', () => {
  let pool;
  let ownerId, viewerId, editorId, wsMemberId;
  let listId, itemId;
  let wsId, projectId; // workspace/project for activity tests
  let wsListId, wsItemId; // list+item inside the workspace project
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
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, VIEWER, EDITOR, WS_MEM]]);

    // Create users
    ownerId   = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER])).rows[0].id;
    viewerId  = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [VIEWER])).rows[0].id;
    editorId  = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [EDITOR])).rows[0].id;
    wsMemberId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [WS_MEM])).rows[0].id;

    // Create a standalone list + item (no workspace) for basic authz tests
    listId = (await pool.query(
      "INSERT INTO lists (name, user_id) VALUES ('C5 List', $1) RETURNING id", [ownerId]
    )).rows[0].id;
    itemId = (await pool.query(
      "INSERT INTO list_items (list_id, text, position) VALUES ($1,'C5 Item',1) RETURNING id", [listId]
    )).rows[0].id;

    // Share list with viewer (view) and editor (edit)
    await pool.query(
      "INSERT INTO list_shares (list_id, user_id, permission) VALUES ($1,$2,'view')", [listId, viewerId]
    );
    await pool.query(
      "INSERT INTO list_shares (list_id, user_id, permission) VALUES ($1,$2,'edit')", [listId, editorId]
    );

    // Create a workspace + project + list + item for mention/activity tests
    wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('C5 WS', $1) RETURNING id", [ownerId]
    )).rows[0].id;
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')", [wsId, ownerId]
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'member')", [wsId, wsMemberId]
    );
    projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'C5 Project') RETURNING id", [wsId]
    )).rows[0].id;
    wsListId = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('C5 WS List', $1, $2) RETURNING id",
      [ownerId, projectId]
    )).rows[0].id;
    wsItemId = (await pool.query(
      "INSERT INTO list_items (list_id, text, position) VALUES ($1,'C5 WS Item',1) RETURNING id", [wsListId]
    )).rows[0].id;

    // Build the minimal express app, mounting ONLY the real comments router
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
    // Mount under /api (same as server.js wiring)
    app.use('/api', makeCommentsRouter(authenticateToken, sanitize, emit));
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, VIEWER, EDITOR, WS_MEM]]);
    await pool.end();
  });

  beforeEach(() => {
    emit.list.mockClear();
    emit.workspace.mockClear();
  });

  // ─── GET /api/items/:id/comments ─────────────────────────────────────────

  describe('GET /api/items/:id/comments', () => {
    test('view-share user can GET comments → 200', async () => {
      const r = await request(app)
        .get(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    test('owner can GET comments → 200', async () => {
      const r = await request(app)
        .get(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(200);
    });

    test('unrelated user cannot GET comments → 403', async () => {
      // wsMemberId has no access to the standalone listId
      const r = await request(app)
        .get(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(wsMemberId, WS_MEM)}`);
      expect(r.status).toBe(403);
    });

    test('non-existent item → 404', async () => {
      const r = await request(app)
        .get('/api/items/999999999/comments')
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(404);
    });

    test('unauthenticated request → 401', async () => {
      const r = await request(app).get(`/api/items/${itemId}/comments`);
      expect(r.status).toBe(401);
    });
  });

  // ─── POST /api/items/:id/comments ────────────────────────────────────────

  describe('POST /api/items/:id/comments', () => {
    test('view-share user cannot POST comment → 403', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`)
        .send({ body: 'hello' });
      expect(r.status).toBe(403);
      expect(r.body.error).toBe('No edit permission');
    });

    test('edit-share user can POST comment → 201', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(editorId, EDITOR)}`)
        .send({ body: 'edit user comment' });
      expect(r.status).toBe(201);
      expect(r.body.body).toBe('edit user comment');
      expect(r.body.id).toBeTruthy();
      expect(r.body.user_id).toBe(editorId);
    });

    test('GET after POST returns the new comment', async () => {
      // POST first
      const post = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(editorId, EDITOR)}`)
        .send({ body: 'new comment to verify' });
      expect(post.status).toBe(201);

      // GET should include it
      const get = await request(app)
        .get(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(get.status).toBe(200);
      expect(get.body.some(c => c.id === post.body.id)).toBe(true);
    });

    test('POST with empty body → 400', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: '' });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Comment body required');
    });

    test('POST with missing body field → 400', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({});
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Comment body required');
    });

    test('POST on non-existent item → 404', async () => {
      const r = await request(app)
        .post('/api/items/999999999/comments')
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: 'ghost comment' });
      expect(r.status).toBe(404);
    });

    test('POST emits COMMENT_CREATED list event', async () => {
      emit.list.mockClear();
      await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: 'emit test' });
      expect(emit.list).toHaveBeenCalledTimes(1);
      const [calledListId, eventName] = emit.list.mock.calls[0];
      expect(calledListId).toBe(listId);
      expect(eventName).toBe(events.COMMENT_CREATED);
    });
  });

  // ─── DELETE /api/comments/:id ─────────────────────────────────────────────

  describe('DELETE /api/comments/:id', () => {
    let commentByEditor, commentByOwner;

    beforeEach(async () => {
      // Seed fresh comments before each delete test
      commentByEditor = (await pool.query(
        "INSERT INTO comments (item_id, user_id, body) VALUES ($1,$2,'editor comment') RETURNING *",
        [itemId, editorId]
      )).rows[0];
      commentByOwner = (await pool.query(
        "INSERT INTO comments (item_id, user_id, body) VALUES ($1,$2,'owner comment') RETURNING *",
        [itemId, ownerId]
      )).rows[0];
    });

    test('author can delete own comment → 200', async () => {
      const r = await request(app)
        .delete(`/api/comments/${commentByEditor.id}`)
        .set('Authorization', `Bearer ${tokenFor(editorId, EDITOR)}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);

      // Verify it's gone from DB
      const check = await pool.query('SELECT id FROM comments WHERE id=$1', [commentByEditor.id]);
      expect(check.rows).toHaveLength(0);
    });

    test('list owner can delete someone else\'s comment → 200', async () => {
      const r = await request(app)
        .delete(`/api/comments/${commentByEditor.id}`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });

    test('non-author non-owner (view-share) cannot delete → 403', async () => {
      const r = await request(app)
        .delete(`/api/comments/${commentByOwner.id}`)
        .set('Authorization', `Bearer ${tokenFor(viewerId, VIEWER)}`);
      expect(r.status).toBe(403);
      expect(r.body.error).toBe('Not authorized');
    });

    test('non-existent comment → 404', async () => {
      const r = await request(app)
        .delete('/api/comments/999999999')
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(404);
      expect(r.body.error).toBe('Comment not found');
    });

    test('DELETE emits COMMENT_DELETED list event', async () => {
      emit.list.mockClear();
      const r = await request(app)
        .delete(`/api/comments/${commentByOwner.id}`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`);
      expect(r.status).toBe(200);
      expect(emit.list).toHaveBeenCalledTimes(1);
      const [calledListId, eventName, payload] = emit.list.mock.calls[0];
      expect(calledListId).toBe(listId);
      expect(eventName).toBe(events.COMMENT_DELETED);
      expect(payload.commentId).toBe(commentByOwner.id);
    });
  });

  // ─── Activity / @mention (workspace-linked lists) ─────────────────────────

  describe('Activity + @mention (workspace list)', () => {
    test('POST on workspace-linked item creates a "commented" activity row', async () => {
      const r = await request(app)
        .post(`/api/items/${wsItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: 'no mentions here' });
      expect(r.status).toBe(201);

      // Give the best-effort activity block time (it's awaited but non-throwing)
      const actRows = await pool.query(
        "SELECT * FROM activity WHERE workspace_id=$1 AND verb='commented' ORDER BY created_at DESC LIMIT 1",
        [wsId]
      );
      expect(actRows.rows).toHaveLength(1);
      const act = actRows.rows[0];
      expect(act.actor_id).toBe(ownerId);
      expect(act.target.commentId).toBe(r.body.id);
    });

    test('POST with @<member-local-part> creates a "mentioned" activity row for that member', async () => {
      // WS_MEM email is 'c5-wsmember@example.test' → local part is 'c5-wsmember'
      const handle = WS_MEM.split('@')[0]; // 'c5-wsmember'
      const r = await request(app)
        .post(`/api/items/${wsItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: `hey @${handle} check this out` });
      expect(r.status).toBe(201);

      const mentionRows = await pool.query(
        `SELECT * FROM activity WHERE workspace_id=$1 AND verb='mentioned'
         AND meta->>'mentionedUserId' = $2
         ORDER BY created_at DESC LIMIT 1`,
        [wsId, String(wsMemberId)]
      );
      expect(mentionRows.rows).toHaveLength(1);
      const mention = mentionRows.rows[0];
      expect(mention.actor_id).toBe(ownerId);
      expect(mention.target.commentId).toBe(r.body.id);
    });

    test('author is not mentioned for their own @self mention', async () => {
      // OWNER mentions themselves — should NOT create a "mentioned" row for ownerId
      const handle = OWNER.split('@')[0]; // 'c5-owner'
      const before = await pool.query(
        `SELECT COUNT(*)::int AS c FROM activity
         WHERE workspace_id=$1 AND verb='mentioned'
           AND meta->>'mentionedUserId' = $2`,
        [wsId, String(ownerId)]
      );
      const countBefore = before.rows[0].c;

      await request(app)
        .post(`/api/items/${wsItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: `I am @${handle} and I mention myself` });

      const after = await pool.query(
        `SELECT COUNT(*)::int AS c FROM activity
         WHERE workspace_id=$1 AND verb='mentioned'
           AND meta->>'mentionedUserId' = $2`,
        [wsId, String(ownerId)]
      );
      expect(after.rows[0].c).toBe(countBefore);
    });

    test('activity failure does not break the comment response', async () => {
      // We simulate this by checking that a successful comment on a workspace
      // item still returns 201 even when emit.workspace might throw
      emit.workspace.mockImplementationOnce(() => { throw new Error('socket down'); });
      const r = await request(app)
        .post(`/api/items/${wsItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: 'resilience test' });
      // The thrown error is inside the try/catch block, so response must still be 201
      expect(r.status).toBe(201);
      expect(r.body.body).toBe('resilience test');
    });

    test('workspace emit is called for workspace-linked item comment', async () => {
      emit.workspace.mockClear();
      const r = await request(app)
        .post(`/api/items/${wsItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`)
        .send({ body: 'ws emit check' });
      expect(r.status).toBe(201);
      // At least one workspace emit should have fired (for "commented")
      expect(emit.workspace).toHaveBeenCalled();
      const [calledWsId, eventName] = emit.workspace.mock.calls[0];
      expect(calledWsId).toBe(wsId);
      expect(eventName).toBe(events.ACTIVITY_CREATED);
    });
  });
});
