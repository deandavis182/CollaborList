// backend/__tests__/notification-triggers.integration.test.js
// Integration tests for notification push triggers wired in Task 5.
// Mounts the real comments router against a real DB but spies on notificationService
// so no actual push subscriptions are needed.
//
// Coverage:
//   - @mention in a workspace comment → notifyMention called with mentionedUserId
//   - Comment on an item assigned to another user → notifyComment called with watcherIds=[assigneeId]
//   - Self-comment by the assignee → notifyComment called with watcherIds=[actorId] (service skips actor internally)
'use strict';

jest.mock('../services/notificationService');

const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const makeCommentsRouter = require('../routes/comments');
const notificationService = require('../services/notificationService');

const OWNER_EMAIL  = 'nt-owner@example.test';
const EDITOR_EMAIL = 'nt-editor@example.test';
const ASSIGN_EMAIL = 'nt-assignee@example.test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const tokenFor   = (id, email) => jwt.sign({ id, email }, JWT_SECRET);

const sanitize = (s) => (s == null ? '' : String(s)).replace(/[<>"'`;(){}[\]\\]/g, '').slice(0, 1000);
const emit = { list: jest.fn(), workspace: jest.fn() };

describe('Notification push triggers (real DB + mocked notificationService)', () => {
  let pool;
  let ownerId, editorId, assigneeId;
  let wsId, projectId, listId, itemId, assignedItemId;
  let app;

  beforeAll(async () => {
    pool = new Pool({
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'listapp',
      user:     process.env.DB_USER     || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    await pool.query(
      'DELETE FROM users WHERE email = ANY($1)',
      [[OWNER_EMAIL, EDITOR_EMAIL, ASSIGN_EMAIL]]
    );

    ownerId    = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER_EMAIL])).rows[0].id;
    editorId   = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [EDITOR_EMAIL])).rows[0].id;
    assigneeId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [ASSIGN_EMAIL])).rows[0].id;

    // Workspace + members
    wsId = (await pool.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ('NT WS', $1) RETURNING id", [ownerId]
    )).rows[0].id;
    await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')",  [wsId, ownerId]);
    await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'member')", [wsId, editorId]);
    await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'member')", [wsId, assigneeId]);

    projectId = (await pool.query(
      "INSERT INTO projects (workspace_id, name) VALUES ($1,'NT Project') RETURNING id", [wsId]
    )).rows[0].id;

    listId = (await pool.query(
      "INSERT INTO lists (name, user_id, project_id) VALUES ('NT List', $1, $2) RETURNING id",
      [ownerId, projectId]
    )).rows[0].id;

    // Unassigned item (for mention tests)
    itemId = (await pool.query(
      "INSERT INTO list_items (list_id, text, position) VALUES ($1,'NT Item',1) RETURNING id", [listId]
    )).rows[0].id;

    // Give assignee edit access to the list so they can post comments
    await pool.query(
      "INSERT INTO list_shares (list_id, user_id, permission) VALUES ($1,$2,'edit')",
      [listId, assigneeId]
    );

    // Item assigned to assigneeId (for notifyComment tests)
    assignedItemId = (await pool.query(
      "INSERT INTO list_items (list_id, text, position, assignee_id) VALUES ($1,'NT Assigned Item',2,$2) RETURNING id",
      [listId, assigneeId]
    )).rows[0].id;

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
    app.use('/api', makeCommentsRouter(authenticateToken, sanitize, emit));
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM users WHERE email = ANY($1)',
      [[OWNER_EMAIL, EDITOR_EMAIL, ASSIGN_EMAIL]]
    );
    await pool.end();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Make notificationService methods resolve silently by default
    notificationService.notifyMention.mockResolvedValue(undefined);
    notificationService.notifyComment.mockResolvedValue(undefined);
    notificationService.notifyAssignment.mockResolvedValue(undefined);
  });

  describe('notifyMention', () => {
    test('posting @<editor-handle> in workspace comment calls notifyMention with mentionedUserId', async () => {
      const handle = EDITOR_EMAIL.split('@')[0]; // 'nt-editor'
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER_EMAIL)}`)
        .send({ body: `hey @${handle} please review` });

      expect(r.status).toBe(201);
      expect(notificationService.notifyMention).toHaveBeenCalledTimes(1);
      const call = notificationService.notifyMention.mock.calls[0];
      // First arg is pool, second is the options object
      expect(call[1]).toMatchObject({
        mentionedUserId: editorId,
        actorId: ownerId,
      });
    });

    test('self-mention does NOT call notifyMention', async () => {
      const handle = OWNER_EMAIL.split('@')[0]; // 'nt-owner'
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER_EMAIL)}`)
        .send({ body: `I @${handle} mention myself` });

      expect(r.status).toBe(201);
      expect(notificationService.notifyMention).not.toHaveBeenCalled();
    });
  });

  describe('notifyComment (assignee as watcher)', () => {
    test('comment by non-assignee on assigned item calls notifyComment with watcherIds=[assigneeId]', async () => {
      const r = await request(app)
        .post(`/api/items/${assignedItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER_EMAIL)}`)
        .send({ body: 'FYI on your assigned item' });

      expect(r.status).toBe(201);
      expect(notificationService.notifyComment).toHaveBeenCalledTimes(1);
      const call = notificationService.notifyComment.mock.calls[0];
      expect(call[1]).toMatchObject({
        watcherIds: [assigneeId],
        actorId: ownerId,
      });
    });

    test('comment by assignee on own item calls notifyComment with watcherIds=[assigneeId] (service skips actor internally)', async () => {
      // notifyComment is called with watcherIds=[assigneeId]; the service itself skips
      // wid === actorId, so no push is sent — but the call IS made.
      const r = await request(app)
        .post(`/api/items/${assignedItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(assigneeId, ASSIGN_EMAIL)}`)
        .send({ body: 'I am commenting on my own item' });

      expect(r.status).toBe(201);
      expect(notificationService.notifyComment).toHaveBeenCalledTimes(1);
      const call = notificationService.notifyComment.mock.calls[0];
      // watcherIds contains the assignee; actorId is also the assignee.
      // notifyComment skips actor internally — this test just confirms the call shape.
      expect(call[1].watcherIds).toContain(assigneeId);
      expect(call[1].actorId).toBe(assigneeId);
    });

    test('comment on unassigned item calls notifyComment with empty watcherIds', async () => {
      const r = await request(app)
        .post(`/api/items/${itemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER_EMAIL)}`)
        .send({ body: 'no assignee here' });

      expect(r.status).toBe(201);
      expect(notificationService.notifyComment).toHaveBeenCalledTimes(1);
      const call = notificationService.notifyComment.mock.calls[0];
      expect(call[1].watcherIds).toEqual([]);
    });

    test('push failure does not break comment response', async () => {
      notificationService.notifyComment.mockRejectedValueOnce(new Error('push down'));
      const r = await request(app)
        .post(`/api/items/${assignedItemId}/comments`)
        .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER_EMAIL)}`)
        .send({ body: 'resilience test' });

      expect(r.status).toBe(201);
    });
  });
});
