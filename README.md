# CollaborList 📋✨

A modern, real-time collaborative list management application with user authentication and live synchronization.

🌐 **Live at:** [collaborlist.com](https://collaborlist.com)

## Features

- 🔐 **User Authentication** - Email/password registration and login
- 🔄 **Real-time Collaboration** - Live updates across all connected users via WebSockets
- 👥 **List Sharing** - Share lists with view or edit permissions
- ⚡ **Optimistic UI** - Instant feedback with smart synchronization
- 🎯 **Minimal Design** - Clean, responsive interface
- 🐳 **Fully Containerized** - Docker Compose for easy deployment
- 🔑 **Google OAuth Ready** - Infrastructure prepared for Google Sign-In

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Socket.io Client
- **Backend**: Node.js + Express + Socket.io + JWT Authentication
- **Database**: PostgreSQL
- **Deployment**: Docker + Docker Compose

## Quick Start (Local Development)

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for local development without Docker)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/collaborlist.git
cd collaborlist
```

### 2. Start with Docker Compose
```bash
docker-compose up -d
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 3. Default Credentials
For testing, you can register a new account or use:
- Email: `test@example.com`
- Password: `test123`

## Project Structure

```
.
├── backend/              # Node.js Express API with Socket.io
├── frontend/             # React SPA with Tailwind
├── database/             # PostgreSQL initialization
├── docker-compose.yml    # Development setup
├── docker-compose.traefik.yml  # Production with SSL
├── .env.production.example      # Production config template
├── deploy-simple.sh      # One-command deploy script
└── DEPLOYMENT.md         # Deployment guide
```

## Deployment to Production

### Quick Deploy with Automatic SSL (Recommended)

Deploy CollaborList with automatic HTTPS in under 5 minutes:

1. **Clone on your server:**
```bash
git clone https://github.com/yourusername/collaborlist.git
cd collaborlist
```

2. **Configure environment:**
```bash
cp .env.production.example .env
nano .env  # Set DOMAIN, passwords, and email
```

3. **Deploy:**
```bash
./deploy-simple.sh
```

That's it! Your app will be live at `https://yourdomain.com` with automatic SSL certificates.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions and management commands.

### Deploy to Cloud Platforms

#### Heroku
1. Install Heroku CLI
2. Create `heroku.yml` in project root:
```yaml
build:
  docker:
    web: backend/Dockerfile
    worker: frontend/Dockerfile
```
3. Deploy:
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:mini
git push heroku main
```

#### Railway/Render
Both platforms support Docker Compose deployment:
1. Connect your GitHub repository
2. Add environment variables in dashboard
3. Deploy automatically on push

#### AWS/GCP/Azure
Use their container services (ECS, Cloud Run, Container Instances) with the Docker images.

## Setting Up Google OAuth

Google OAuth is already integrated into CollaborList! You just need to configure it with your Google Client ID.

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API

### 2. Configure OAuth Consent Screen

1. Navigate to "APIs & Services" > "OAuth consent screen"
2. Choose "External" for user type
3. Fill in required information:
   - App name: "CollaborList"
   - User support email: your email
   - Developer contact: your email
4. Add scopes: `email` and `profile`
5. Add test users if in development

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Add authorized JavaScript origins:
   - For local: `http://localhost:3000`
   - For production: `https://collaborlist.com`
5. Add authorized redirect URIs (not required for implicit flow)
6. Save and copy your Client ID

### 4. Configure Your Application

Add your Google Client ID to the **root `.env` file**:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

That's it! The Google Sign-In button will automatically work once you've set your Client ID in the root `.env` file. Docker Compose handles passing it to both frontend (at build time) and backend (at runtime). The implementation handles:
- Token verification
- User creation/linking
- Automatic login flow
- Account merging for existing email addresses

## Environment Variables

You only need **one `.env` file in the project root** for both development and production.

### For Local Development
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### For Production
Copy `.env.production.example` to `.env`:
```bash
cp .env.production.example .env
```

Then edit `.env` with your values:
```env
# Required for production
DOMAIN=collaborlist.com              # Your domain
ACME_EMAIL=you@example.com          # For SSL certificates
DB_PASSWORD=strong-password         # Database password
JWT_SECRET=32-char-random-string    # JWT security

# Optional (for Google Sign-In)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Login with Google

### Lists (Protected)
- `GET /api/lists` - Get user's lists (owned + shared)
- `POST /api/lists` - Create new list
- `PUT /api/lists/:id` - Update list
- `DELETE /api/lists/:id` - Delete list (owner only)

### List Items (Protected)
- `GET /api/lists/:listId/items` - Get list items
- `POST /api/lists/:listId/items` - Add item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Sharing (Protected)
- `POST /api/lists/:id/share` - Share list with user
- `GET /api/lists/:id/shares` - Get list shares
- `DELETE /api/lists/:listId/shares/:userId` - Remove share

### WebSocket Events
- `list-created` - New list created
- `list-updated` - List updated
- `list-deleted` - List deleted
- `item-created` - Item added
- `item-updated` - Item updated
- `item-deleted` - Item removed
- `list-shared` - List shared
- `share-removed` - Share revoked

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secret**: Use strong, random string (minimum 32 characters)
3. **Database Password**: Use strong passwords in production
4. **HTTPS**: Always use SSL/TLS in production
5. **CORS**: Configure appropriate origins in production
6. **Rate Limiting**: Consider adding rate limiting for API endpoints
7. **Input Validation**: Add validation for user inputs

## Backup and Recovery

### Backup Database
```bash
docker exec listapp-db pg_dump -U listuser listapp > backup.sql
```

### Restore Database
```bash
docker exec -i listapp-db psql -U listuser listapp < backup.sql
```

## Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Health Check
```bash
curl http://localhost:3001/api/health
```

## Troubleshooting

### Container Issues
```bash
# Restart all services
docker-compose restart

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Database Issues
```bash
# Reset database
docker-compose down -v
docker-compose up -d
```

### Port Conflicts
If ports 3000 or 3001 are in use, update `docker-compose.yml`:
```yaml
ports:
  - "8080:80"    # Frontend
  - "8081:3001"  # Backend
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## About CollaborList

CollaborList was built to make shared task management simple and seamless. Whether you're managing household chores, planning shopping trips, or coordinating team tasks, CollaborList keeps everyone in sync with real-time updates.

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues, questions, or suggestions, please open an issue on [GitHub](https://github.com/yourusername/collaborlist).

---

**CollaborList** - Built with ❤️ using React, Node.js, PostgreSQL, Socket.io, and Docker

🌐 Visit us at [collaborlist.com](https://collaborlist.com)