const sharedPool = require('./pool');

const migrations = [
  {
    name: '001_add_notes_column',
    sql: `ALTER TABLE list_items ADD COLUMN IF NOT EXISTS notes TEXT`
  },
  {
    name: '002_add_parent_id_column',
    sql: `
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_list_items_parent_id ON list_items(parent_id);
      CREATE INDEX IF NOT EXISTS idx_list_items_list_parent ON list_items(list_id, parent_id);
    `
  },
  {
    name: '003_create_workspaces',
    sql: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);
    `
  },
  {
    name: '004_create_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20),
        wedding_date DATE,
        archived BOOLEAN DEFAULT FALSE,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
    `
  },
  {
    name: '005_add_list_project_id',
    sql: `
      ALTER TABLE lists ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_lists_project ON lists(project_id);
    `
  },
  {
    name: '006_create_tags',
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS item_tags (
        item_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
      );
    `
  },
  {
    name: '007_create_fields',
    sql: `
      CREATE TABLE IF NOT EXISTS field_defs (
        id SERIAL PRIMARY KEY,
        list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        label VARCHAR(255),
        config JSONB DEFAULT '{}'::jsonb,
        position INTEGER DEFAULT 0,
        UNIQUE(list_id, key)
      );
      CREATE TABLE IF NOT EXISTS item_fields (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        value JSONB,
        UNIQUE(item_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_item_fields_item ON item_fields(item_id);
    `
  },
  {
    name: '008_create_comments',
    sql: `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES list_items(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_id);
    `
  },
  {
    name: '009_create_activity',
    sql: `
      CREATE TABLE IF NOT EXISTS activity (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        verb VARCHAR(50) NOT NULL,
        target JSONB,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity(workspace_id, created_at DESC);
    `
  },
  {
    name: '010_create_push_and_prefs',
    sql: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        keys JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(endpoint)
      );
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        prefs JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `
  },
  {
    name: '011_add_item_collab_columns',
    sql: `
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS status VARCHAR(20);
      ALTER TABLE list_items ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_list_items_assignee ON list_items(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_list_items_due ON list_items(due_date);
    `
  },
  {
    name: '012_backfill_workspaces_projects',
    sql: `
      -- 1. A "Personal" workspace for every user who doesn't own one yet
      INSERT INTO workspaces (name, owner_id)
      SELECT 'Personal', u.id FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM workspaces w WHERE w.owner_id = u.id AND w.name = 'Personal'
      );

      -- 2. Owner membership for every workspace owner
      INSERT INTO workspace_members (workspace_id, user_id, role)
      SELECT w.id, w.owner_id, 'owner' FROM workspaces w
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_members m
        WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
      );

      -- 3. A "General" project in each Personal workspace
      INSERT INTO projects (workspace_id, name)
      SELECT w.id, 'General' FROM workspaces w
      WHERE w.name = 'Personal'
        AND NOT EXISTS (
          SELECT 1 FROM projects p WHERE p.workspace_id = w.id AND p.name = 'General'
        );

      -- 4. Attach each orphan list to its owner's General project
      UPDATE lists l SET project_id = p.id
      FROM workspaces w
      JOIN projects p ON p.workspace_id = w.id AND p.name = 'General'
      WHERE w.owner_id = l.user_id AND l.project_id IS NULL;

      -- 5. Backfill status from completed (only where unset)
      UPDATE list_items SET status = CASE WHEN completed THEN 'Done' ELSE 'To do' END
      WHERE status IS NULL;
    `
  },
  {
    name: '013_collab_defaults_and_watermark',
    sql: `
      ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS last_seen_activity TIMESTAMP;
      ALTER TABLE list_items ALTER COLUMN status SET DEFAULT 'To do';
      UPDATE list_items SET status = CASE WHEN completed THEN 'Done' ELSE 'To do' END WHERE status IS NULL;
    `
  },
];

async function runMigrations(pool = sharedPool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const migration of migrations) {
      const result = await pool.query(
        'SELECT name FROM migrations WHERE name = $1',
        [migration.name]
      );
      if (result.rows.length === 0) {
        console.log(`Applying migration: ${migration.name}`);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(migration.sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
          await client.query('COMMIT');
          console.log(`✅ Migration ${migration.name} applied successfully`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Failed to apply migration ${migration.name}:`, err.message);
        } finally {
          client.release();
        }
      }
    }
    console.log('All migrations checked/applied');
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

module.exports = { migrations, runMigrations };
