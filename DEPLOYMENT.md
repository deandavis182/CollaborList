# CollaborList - Simple Production Deployment

Deploy CollaborList with automatic SSL in 5 minutes!

## Prerequisites
- A server with Docker & Docker Compose installed
- A domain name pointing to your server's IP

## Quick Deploy

1. **SSH to your server & clone the repo:**
```bash
git clone https://github.com/yourusername/collaborlist.git
cd collaborlist
```

2. **Create your .env file:**
```bash
cp .env.production.example .env
nano .env
```

Set these values:
```env
DOMAIN=collaborlist.com              # Your domain
ACME_EMAIL=you@example.com          # For SSL certificates
DB_PASSWORD=strong-password-here    # Database password
JWT_SECRET=32-char-random-string    # For JWT tokens
GOOGLE_CLIENT_ID=optional           # For Google login
```

3. **Deploy:**
```bash
chmod +x deploy-simple.sh
./deploy-simple.sh
```

That's it! 🎉 Your app will be available at `https://yourdomain.com` with automatic SSL.

## How It Works

- **Traefik** handles SSL certificates automatically via Let's Encrypt
- **PostgreSQL** stores your data persistently
- **Backend & Frontend** run in Docker containers
- Everything routes through Traefik with proper SSL

## Updating an Existing Deployment (e.g. to a new release / V2)

This is the safe procedure to pull a new version onto a server that **already
has live user data**. Your data lives in the `postgres_data` Docker volume and
is preserved across rebuilds as long as you do NOT delete that volume. All schema
migrations are additive (`CREATE TABLE/ADD COLUMN IF NOT EXISTS` + idempotent
backfills) and run automatically on backend boot, so they add new tables/columns
without dropping or rewriting existing rows.

**On your local machine — publish the code first:**
```bash
git push origin main
```

**On the production server:**
```bash
cd /path/to/CollaborList                 # your clone (production compose lives here)

# 1. Back up the database FIRST (belt-and-suspenders rollback)
docker exec listapp-db pg_dump -U listuser listapp > backup-$(date +%Y%m%d-%H%M%S).sql
ls -lh backup-*.sql                      # confirm it is non-empty

# 2. Pull the new code (.env is gitignored, so your secrets are untouched)
git pull origin main

# 3. (Optional) enable Web Push — generate keys once and add to .env.
#    Without these the app runs normally with push disabled (no-op).
npx web-push generate-vapid-keys
nano .env                                # add VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT

# 4. Rebuild + restart (down does NOT touch named volumes; data survives)
./deploy-simple.sh

# 5. Watch the backend come up and apply migrations
docker compose -f docker-compose.traefik.yml logs -f backend
#    Look for: "All migrations checked/applied" and "running on port 3001"
```

Then load the site, log in as an **existing** user, and confirm old lists are
present plus the new features (custom fields, attachments, recurrence, notifications).

**A fresh empty `attachments_data` volume is created automatically** on the first
V2 deploy — there are no prior attachments to preserve.

### ⚠️ Do NOT
- **Never run `docker compose ... down -v`** — the `-v` deletes `postgres_data`
  (all user data). Plain `down` (what the deploy script uses) is safe.
- **Do not change `DB_PASSWORD`** between deploys. Postgres only applies the
  password when it first initializes an empty data volume; on an existing volume
  it is ignored, so a changed value would lock the backend out of its own DB.

### Rollback
```bash
# restore the data snapshot
cat backup-YYYYMMDD-HHMMSS.sql | docker exec -i listapp-db psql -U listuser listapp
# and/or roll the code back to the previous release, then redeploy
git checkout <previous-commit-sha>
./deploy-simple.sh
```

## Management Commands

```bash
# View logs
docker-compose -f docker-compose.traefik.yml logs -f

# Restart services
docker-compose -f docker-compose.traefik.yml restart

# Stop everything
docker-compose -f docker-compose.traefik.yml down

# Backup database
docker exec listapp-db pg_dump -U listuser listapp > backup.sql
```

## Troubleshooting

- **SSL not working?** Make sure port 80 & 443 are open in firewall
- **Domain not resolving?** Check DNS A record points to server IP
- **Can't connect?** Check `docker-compose -f docker-compose.traefik.yml logs traefik`

## V2 Migration Safety

The V2 schema migrations (003–015) are additive and backfilling — they never
drop or rewrite data, and each runs in a transaction that rolls back on failure.
(003–013 = hub/collaboration/fields; 014 = attachments table; 015 = recurrence columns.)
As a belt-and-suspenders rollback, snapshot the database immediately before
deploying a release that introduces new migrations:

```bash
docker exec listapp-db pg_dump -U listuser listapp > backup-$(date +%Y%m%d-%H%M%S).sql
```

To restore if needed:

```bash
cat backup-YYYYMMDD-HHMMSS.sql | docker exec -i listapp-db psql -U listuser listapp
```

**Note on integration testing:** The integration test suite (`npm run test:integration`)
seeds and mutates the database and must always run against a dedicated test database
(e.g., a separate `DB_NAME`), never against a production database.