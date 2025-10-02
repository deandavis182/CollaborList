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
├── backend/           # Node.js Express API with Socket.io
│   ├── server.js      # Main server with auth & real-time features
│   ├── package.json   # Backend dependencies
│   └── Dockerfile
├── frontend/          # React SPA with Tailwind
│   ├── src/
│   │   └── RealtimeApp.jsx  # Main app component
│   ├── package.json   # Frontend dependencies
│   └── Dockerfile
├── database/          # PostgreSQL initialization
│   ├── init.sql       # Initial schema
│   └── 02-add-users.sql  # User tables
└── docker-compose.yml # Container orchestration
```

## Deployment to Production

### Option 1: Deploy with Docker on VPS/Cloud VM

#### Prerequisites
- A VPS or Cloud VM (AWS EC2, DigitalOcean, Linode, etc.)
- Domain name pointed to your server's IP
- Docker and Docker Compose installed on server

#### Steps

1. **SSH into your server and clone the repository**:
```bash
ssh your-server
git clone https://github.com/yourusername/collaborlist.git
cd collaborlist
```

2. **Create production environment file**:
```bash
cat > .env.production << EOF
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=listapp
DB_USER=listuser
DB_PASSWORD=your-secure-password-here
POSTGRES_PASSWORD=your-secure-password-here

# Backend
JWT_SECRET=your-very-long-random-string-here
PORT=3001

# Google OAuth (see setup below)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
EOF
```

3. **Update docker-compose.yml for production**:
Create a `docker-compose.production.yml`:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: listapp-db
    env_file: .env.production
    volumes:
      - ./database/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./database/02-add-users.sql:/docker-entrypoint-initdb.d/02-add-users.sql
      - postgres_data:/var/lib/postgresql/data
    networks:
      - listapp-network
    restart: always

  backend:
    build: ./backend
    container_name: listapp-backend
    env_file: .env.production
    depends_on:
      - postgres
    networks:
      - listapp-network
    restart: always

  frontend:
    build: ./frontend
    container_name: listapp-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - listapp-network
    restart: always

volumes:
  postgres_data:

networks:
  listapp-network:
    driver: bridge
```

4. **Deploy**:
```bash
docker-compose -f docker-compose.production.yml up -d --build
```

5. **Set up NGINX with SSL (recommended)**:
Install NGINX and Certbot on your server:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Create NGINX config
sudo nano /etc/nginx/sites-available/listapp
```

Add this configuration:
```nginx
server {
    server_name collaborlist.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and get SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/listapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d collaborlist.com
```

### Option 2: Deploy to Cloud Platforms

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
5. Add authorized redirect URIs:
   - For local: `http://localhost:3000/auth/google/callback`
   - For production: `https://collaborlist.com/auth/google/callback`
6. Save and copy your Client ID

### 4. Update Application

1. **Backend**: Add to `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

2. **Frontend**: Update `RealtimeApp.jsx` to add Google Sign-In library:
```html
<!-- Add to index.html before closing </body> -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

3. **Implement Google login** in backend `server.js`:
```javascript
// Replace the placeholder Google OAuth endpoint with:
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;

    // Check if user exists
    let user = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 OR google_id = $2',
      [email, googleId]
    );

    if (user.rows.length === 0) {
      // Create new user
      const result = await pool.query(
        'INSERT INTO users (email, google_id, password_hash) VALUES ($1, $2, $3) RETURNING id, email',
        [email, googleId, 'google-oauth']
      );
      user = result;
    }

    const token = jwt.sign({
      id: user.rows[0].id,
      email: user.rows[0].email
    }, JWT_SECRET);

    res.json({ token, user: user.rows[0] });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});
```

## Environment Variables

### Development (.env)
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=listapp
DB_USER=listuser
DB_PASSWORD=listpass

# Backend
JWT_SECRET=development-secret-change-in-production
PORT=3001

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Production (.env.production)
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=listapp_prod
DB_USER=produser
DB_PASSWORD=strong-random-password
POSTGRES_PASSWORD=strong-random-password

# Backend
JWT_SECRET=very-long-random-string-minimum-32-chars
PORT=3001

# Google OAuth
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