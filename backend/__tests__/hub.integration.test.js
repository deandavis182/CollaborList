// backend/__tests__/hub.integration.test.js
const { Pool } = require('pg');
const { getWorkspaceRole } = require('../middleware/permissions');
const ws = require('../services/workspaceService');

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
