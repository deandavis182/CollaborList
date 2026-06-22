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
