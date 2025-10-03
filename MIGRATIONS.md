# Database Migration Strategy

## The Dual-Track Approach

We use a **dual-track system** to handle both fresh and existing deployments:

### Track 1: Fresh Deployments (database/*.sql files)
- SQL files in `database/` folder run when PostgreSQL container initializes a **new** database
- These create the complete, up-to-date schema from scratch
- Files run in alphabetical order (01-init.sql, 02-add-users.sql, 03-add-notes.sql, etc.)

### Track 2: Existing Deployments (backend migrations)
- Migrations in `backend/server.js` run on **every** server startup
- These update existing databases to match the latest schema
- Only unapplied migrations run (tracked in `migrations` table)

## Why Both Tracks?

- **Fresh deployments** need the complete schema immediately (no migration history)
- **Existing deployments** need incremental updates without data loss
- Keeping both ensures consistency across all environments

## Adding New Features (The Process)

When adding a database change, you need **BOTH**:

### 1. Create SQL file for fresh deployments
```bash
# Example: database/04-add-tags.sql
\c listapp;

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);
```

### 2. Add migration for existing deployments
```javascript
// In backend/server.js migrations array:
{
  name: '002_add_tags_table',
  sql: `CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
  )`
}
```

### 3. Update docker-compose files
Add the new SQL file to all docker-compose files:
```yaml
volumes:
  - ./database/04-add-tags.sql:/docker-entrypoint-initdb.d/04-add-tags.sql
```

## Real Example: Notes Feature

We added notes with:
- `database/03-add-notes.sql` - for fresh deployments
- Migration `001_add_notes_column` - for existing deployments

Both contain the same change:
```sql
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS notes TEXT
```

## Deployment Process

Just run:
```bash
git pull && ./deploy-simple.sh
```

The system automatically:
1. Applies SQL files if it's a fresh database
2. Runs migrations if it's an existing database
3. Keeps everything in sync

## Best Practices

1. **Always create both** - SQL file AND migration
2. **Use IF NOT EXISTS** - Makes operations idempotent
3. **Number sequentially** - 04-, 05-, etc. for SQL files; 002_, 003_, etc. for migrations
4. **Test both paths** - Fresh install and upgrade from existing

## Troubleshooting

```bash
# Check applied migrations
docker compose -f docker-compose.traefik.yml exec postgres psql -U listuser -d listapp -c "SELECT * FROM migrations;"

# View migration logs
docker compose -f docker-compose.traefik.yml logs backend | grep -i migration

# Check table structure
docker compose -f docker-compose.traefik.yml exec postgres psql -U listuser -d listapp -c "\d table_name"
```

## Benefits

- **Zero downtime** - Migrations run on startup
- **No manual intervention** - Just deploy
- **Consistent schema** - Fresh and existing deployments match
- **Safe rollback** - Failed migrations don't crash the server
- **Team-friendly** - Everyone gets the same database automatically