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