// backend/__tests__/hub.integration.test.js
const { Pool } = require('pg');
const { getWorkspaceRole } = require('../middleware/permissions');
const ws = require('../services/workspaceService');
const proj = require('../services/projectService');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const makeWorkspacesRouter = require('../routes/workspaces');

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
});

describe('Project service (real DB)', () => {
  let pool, aId, bId;
  const A = 'phase2-proj-a@example.test';
  const B = 'phase2-proj-b@example.test';

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres', port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp', user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[A, B]]);
    aId = (await pool.query("INSERT INTO users (email, password_hash) VALUES ($1,'x') RETURNING id", [A])).rows[0].id;
    bId = (await pool.query("INSERT INTO users (email, password_hash) VALUES ($1,'x') RETURNING id", [B])).rows[0].id;
  });
  afterAll(async () => { await pool.query('DELETE FROM users WHERE email = ANY($1)', [[A, B]]); await pool.end(); });

  test('project create/list/update', async () => {
    const w = await ws.create(pool, aId, 'Wedding');
    const p = await proj.create(pool, w.id, { name: 'Vendors' });
    expect((await proj.listForWorkspace(pool, w.id)).some(x => x.id === p.id)).toBe(true);
    const u = await proj.update(pool, p.id, { wedding_date: '2026-10-15' });
    expect(u.wedding_date.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(await proj.getWorkspaceIdForProject(pool, p.id)).toBe(w.id);
  });
});

describe('Project routes HTTP permissions (real DB)', () => {
  let pool, ownerId, nonMemberId, wsId, app;
  const OWNER = 'phase2-proj-http-owner@example.test';
  const NON_MEMBER = 'phase2-proj-http-nonmember@example.test';
  const SECRET = process.env.JWT_SECRET || 'test-secret';
  const tokenFor = (id, email) => jwt.sign({ id, email }, SECRET);

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres', port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp', user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, NON_MEMBER]]);
    ownerId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER])).rows[0].id;
    nonMemberId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [NON_MEMBER])).rows[0].id;

    const authenticateToken = (req, res, next) => {
      const h = req.headers['authorization']; const t = h && h.split(' ')[1];
      if (!t) return res.status(401).json({ error: 'Access token required' });
      jwt.verify(t, SECRET, (err, user) => { if (err) return res.status(403).json({ error: 'Invalid token' }); req.user = user; next(); });
    };
    const sanitize = (s) => (s || '').toString();
    app = express();
    app.use(express.json());
    app.use('/api/workspaces', makeWorkspacesRouter(authenticateToken, sanitize));
    app.use('/api/projects', require('../routes/projects')(authenticateToken, sanitize));

    const created = await request(app).post('/api/workspaces')
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`).send({ name: 'Proj HTTP WS' });
    wsId = created.body.id;
  });
  afterAll(async () => { await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, NON_MEMBER]]); await pool.end(); });

  test('non-member gets 403 creating project in owner workspace', async () => {
    const r = await request(app).post(`/api/workspaces/${wsId}/projects`)
      .set('Authorization', `Bearer ${tokenFor(nonMemberId, NON_MEMBER)}`).send({ name: 'Secret Project' });
    expect(r.status).toBe(403);
  });

  test('owner can create project -> 201', async () => {
    const r = await request(app).post(`/api/workspaces/${wsId}/projects`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`).send({ name: 'My Project' });
    expect(r.status).toBe(201);
    expect(r.body.name).toBe('My Project');
  });

  test('non-member gets 403 updating project', async () => {
    const created = await request(app).post(`/api/workspaces/${wsId}/projects`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`).send({ name: 'To Update' });
    const pId = created.body.id;
    const r = await request(app).put(`/api/projects/${pId}`)
      .set('Authorization', `Bearer ${tokenFor(nonMemberId, NON_MEMBER)}`).send({ name: 'Hacked' });
    expect(r.status).toBe(403);
  });
});

describe('Workspace routes HTTP permissions (real DB)', () => {
  let pool, ownerId, memberId, wsId, app;
  const OWNER = 'phase2-http-owner@example.test';
  const MEMBER = 'phase2-http-member@example.test';
  const SECRET = process.env.JWT_SECRET || 'test-secret';
  const tokenFor = (id, email) => jwt.sign({ id, email }, SECRET);

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres', port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp', user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, MEMBER]]);
    ownerId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [OWNER])).rows[0].id;
    memberId = (await pool.query("INSERT INTO users (email,password_hash) VALUES ($1,'x') RETURNING id", [MEMBER])).rows[0].id;

    // Real auth middleware mirroring server.js
    const authenticateToken = (req, res, next) => {
      const h = req.headers['authorization']; const t = h && h.split(' ')[1];
      if (!t) return res.status(401).json({ error: 'Access token required' });
      jwt.verify(t, SECRET, (err, user) => { if (err) return res.status(403).json({ error: 'Invalid token' }); req.user = user; next(); });
    };
    const sanitize = (s) => (s || '').toString();
    app = express();
    app.use(express.json());
    app.use('/api/workspaces', makeWorkspacesRouter(authenticateToken, sanitize));

    // Owner creates a workspace via the API, then adds member
    const created = await request(app).post('/api/workspaces')
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`).send({ name: 'HTTP WS' });
    wsId = created.body.id;
    await request(app).post(`/api/workspaces/${wsId}/members`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`).send({ email: MEMBER, role: 'member' });
  });
  afterAll(async () => { await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER, MEMBER]]); await pool.end(); });

  test('unauthenticated request is 401', async () => {
    const r = await request(app).get('/api/workspaces'); expect(r.status).toBe(401);
  });
  test('member cannot rename workspace (needs admin) -> 403', async () => {
    const r = await request(app).put(`/api/workspaces/${wsId}`)
      .set('Authorization', `Bearer ${tokenFor(memberId, MEMBER)}`).send({ name: 'Nope' });
    expect(r.status).toBe(403);
  });
  test('owner can rename workspace -> 200', async () => {
    const r = await request(app).put(`/api/workspaces/${wsId}`)
      .set('Authorization', `Bearer ${tokenFor(ownerId, OWNER)}`).send({ name: 'Renamed' });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Renamed');
  });
  test('member cannot remove a member (needs owner) -> 403', async () => {
    const r = await request(app).delete(`/api/workspaces/${wsId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${tokenFor(memberId, MEMBER)}`);
    expect(r.status).toBe(403);
  });
});
