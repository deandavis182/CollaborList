// backend/__tests__/migrations.integration.test.js
const { Pool } = require('pg');
const { runMigrations, migrations } = require('../db/migrations');

const SEED_EMAIL = 'phase1-seed@example.test';

describe('V2 migrations (real DB)', () => {
  let pool;
  let userId;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'listapp',
      user: process.env.DB_USER || 'listuser',
      password: process.env.DB_PASSWORD || 'listpass',
    });

    // Base tables exist in the test DB via docker-entrypoint init scripts.
    // Clean any prior seed for this email so the run is deterministic.
    await pool.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);

    // Seed a legacy user + list + items (pre-V2 shape).
    const u = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [SEED_EMAIL]
    );
    userId = u.rows[0].id;
    const l = await pool.query(
      'INSERT INTO lists (name, user_id) VALUES ($1, $2) RETURNING id',
      ['Legacy List', userId]
    );
    const listId = l.rows[0].id;
    await pool.query(
      'INSERT INTO list_items (list_id, text, completed) VALUES ($1, $2, $3), ($1, $4, $5)',
      [listId, 'done item', true, 'open item', false]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);
    await pool.end();
  });

  test('runMigrations applies without throwing and creates the tracking table', async () => {
    await runMigrations(pool);
    const t = await pool.query("SELECT to_regclass('public.migrations') AS reg");
    expect(t.rows[0].reg).toBe('migrations');
  });

  test('V2 tables and columns exist after migration', async () => {
    await runMigrations(pool);

    const tables = ['workspaces', 'workspace_members', 'projects', 'tags',
      'item_tags', 'field_defs', 'item_fields', 'comments', 'activity',
      'push_subscriptions', 'notification_prefs'];
    for (const t of tables) {
      const r = await pool.query("SELECT to_regclass($1) AS reg", [`public.${t}`]);
      expect(r.rows[0].reg).toBe(t);
    }

    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'list_items'
    `);
    const names = cols.rows.map(r => r.column_name);
    expect(names).toEqual(expect.arrayContaining(['assignee_id', 'due_date', 'status', 'reminder_sent']));

    const lcols = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'lists'
    `);
    expect(lcols.rows.map(r => r.column_name)).toContain('project_id');
  });

  test('backfill creates Personal workspace, General project, links list, sets status — losslessly', async () => {
    const beforeUsers = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    const beforeItems = await pool.query('SELECT COUNT(*)::int AS n FROM list_items');

    // Ensure the V2 schema exists, then run the backfill SQL DIRECTLY. We cannot rely on
    // runMigrations to backfill here: migration 012 is name-gated and will not re-run once
    // recorded in the (persistent) migrations table, so the freshly-seeded user would be
    // missed. The backfill SQL is idempotent, so running it directly is safe and processes
    // the seeded user regardless of migrations-table state.
    await runMigrations(pool);
    const backfillSql = migrations.find(m => m.name === '012_backfill_workspaces_projects').sql;
    await pool.query(backfillSql);

    // Personal workspace owned by the seeded user
    const ws = await pool.query(
      "SELECT id FROM workspaces WHERE owner_id = $1 AND name = 'Personal'", [userId]
    );
    expect(ws.rows).toHaveLength(1);
    const wsId = ws.rows[0].id;

    // Owner membership
    const mem = await pool.query(
      "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [wsId, userId]
    );
    expect(mem.rows[0].role).toBe('owner');

    // General project in that workspace
    const proj = await pool.query(
      "SELECT id FROM projects WHERE workspace_id = $1 AND name = 'General'", [wsId]
    );
    expect(proj.rows).toHaveLength(1);

    // The seeded list is linked to that project
    const linked = await pool.query(
      'SELECT project_id FROM lists WHERE user_id = $1', [userId]
    );
    expect(linked.rows[0].project_id).toBe(proj.rows[0].id);

    // status backfilled from completed for the seeded items
    const statuses = await pool.query(`
      SELECT li.completed, li.status FROM list_items li
      JOIN lists l ON l.id = li.list_id WHERE l.user_id = $1 ORDER BY li.completed
    `, [userId]);
    const map = Object.fromEntries(statuses.rows.map(r => [String(r.completed), r.status]));
    expect(map['true']).toBe('Done');
    expect(map['false']).toBe('To do');

    // ZERO LOSS: no users or items were removed
    const afterUsers = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    const afterItems = await pool.query('SELECT COUNT(*)::int AS n FROM list_items');
    expect(afterUsers.rows[0].n).toBe(beforeUsers.rows[0].n);
    expect(afterItems.rows[0].n).toBe(beforeItems.rows[0].n);
  });

  test('backfill is idempotent — re-running the 012 SQL makes no duplicates', async () => {
    await runMigrations(pool);
    const sql = migrations.find(m => m.name === '012_backfill_workspaces_projects').sql;
    // Run the raw backfill SQL TWICE; the WHERE NOT EXISTS guards must prevent duplicates.
    await pool.query(sql);
    await pool.query(sql);
    const ws = await pool.query(
      "SELECT COUNT(*)::int AS n FROM workspaces WHERE owner_id = $1 AND name = 'Personal'", [userId]
    );
    expect(ws.rows[0].n).toBe(1);
    const proj = await pool.query(`
      SELECT COUNT(*)::int AS n FROM projects p
      JOIN workspaces w ON w.id = p.workspace_id
      WHERE w.owner_id = $1 AND p.name = 'General'`, [userId]);
    expect(proj.rows[0].n).toBe(1);
  });
});
