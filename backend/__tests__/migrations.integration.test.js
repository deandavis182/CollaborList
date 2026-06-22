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
});
