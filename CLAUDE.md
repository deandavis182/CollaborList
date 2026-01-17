# CLAUDE.md - CollaborList Project Reference

## Project Overview

**CollaborList** is a real-time collaborative list management web application. Users can create lists, add hierarchical items, share lists with configurable permissions (view/edit), and collaborate in real-time via WebSocket synchronization.

**Live URL**: collaborlist.com

## Tech Stack

### Frontend
- **Framework**: React 18.2 + Vite 5.0
- **Styling**: Tailwind CSS 3.4
- **Real-time**: Socket.io Client 4.6
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable 6-8
- **HTTP Client**: Axios 1.6
- **TypeScript**: Partial (types available)

### Backend
- **Runtime**: Node.js 18 (Alpine)
- **Framework**: Express.js 4.18
- **WebSocket**: Socket.io 4.6
- **Database**: PostgreSQL 15
- **Auth**: JWT (jsonwebtoken 9.0), bcrypt 5.1
- **OAuth**: google-auth-library 9.2 (optional)
- **Testing**: Jest 29.7, Supertest 6.3

### Infrastructure
- **Containerization**: Docker (Alpine-based)
- **Orchestration**: Docker Compose
- **SSL**: Traefik with Let's Encrypt
- **Reverse Proxy**: Nginx (frontend SPA routing)

## Directory Structure

```
CollaborList/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── main.jsx            # Entry point (loads RealtimeApp)
│   │   ├── RealtimeApp.jsx     # Main app (~1800 lines, all features)
│   │   ├── AuthApp.jsx         # Alternative auth-focused version
│   │   ├── App.jsx             # Simplified version (no auth)
│   │   ├── index.css           # Tailwind imports
│   │   └── components/
│   │       ├── Logo.jsx        # Brand logo component
│   │       ├── PrivacyPolicy.jsx
│   │       └── TermsOfService.jsx
│   ├── Dockerfile              # Multi-stage: Node build → Nginx serve
│   ├── nginx.conf              # SPA routing + API/WebSocket proxy
│   ├── vite.config.js          # Dev server: 3000, proxy to backend:3001
│   └── tailwind.config.js
│
├── backend/                     # Express API
│   ├── server.js               # Main server (~1016 lines)
│   ├── security.js             # Security middleware (~207 lines)
│   ├── auth-server.js          # Auth logic (reference)
│   ├── realtime-server.js      # Real-time logic (reference)
│   ├── Dockerfile              # Production image
│   ├── Dockerfile.test         # Test runner image
│   ├── jest.config.js          # Test configuration
│   └── __tests__/
│       └── cross-list-move.test.js  # Comprehensive test suite
│
├── database/                    # SQL migrations (Docker init)
│   ├── init.sql                # Base schema
│   ├── 02-add-users.sql        # User table
│   ├── 03-add-notes.sql        # Notes column
│   └── 04-add-parent-id.sql    # Hierarchical items
│
├── docker-compose.yml          # Development environment
├── docker-compose.production.yml  # Production (manual SSL)
├── docker-compose.traefik.yml  # Production (auto SSL)
├── deploy.sh                   # Deployment script
├── deploy-simple.sh            # One-command Traefik deploy
│
├── .env.example                # Dev environment template
├── .env.production.example     # Production template
│
├── README.md                   # Project documentation
├── DEPLOYMENT.md               # Deployment guide
├── MIGRATIONS.md               # Database migrations
├── SECURITY.md                 # Security features
└── TEST_REALTIME.md            # Real-time testing guide
```

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `frontend/src/RealtimeApp.jsx` | Main application - all UI, state, auth, real-time logic |
| `backend/server.js` | API routes, WebSocket handler, database pool, migrations |
| `backend/security.js` | Rate limiting, CSRF, input validation, security headers |
| `frontend/nginx.conf` | SPA routing, API proxy (/api), WebSocket proxy (/socket.io) |
| `docker-compose.traefik.yml` | Production deployment with automatic SSL |

## Database Schema

```sql
users
├── id (SERIAL PK)
├── email (VARCHAR UNIQUE)
├── password_hash (VARCHAR)
├── google_id (VARCHAR, nullable)
└── created_at (TIMESTAMP)

lists
├── id (SERIAL PK)
├── name (VARCHAR)
├── description (TEXT, nullable)
├── user_id (FK → users, CASCADE)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

list_items
├── id (SERIAL PK)
├── list_id (FK → lists, CASCADE)
├── text (TEXT)
├── completed (BOOLEAN, default FALSE)
├── position (INTEGER, default 0)
├── notes (TEXT, nullable)
├── parent_id (FK → list_items, CASCADE, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

list_shares
├── id (SERIAL PK)
├── list_id (FK → lists, CASCADE)
├── user_id (FK → users, CASCADE)
├── permission ('view' | 'edit')
├── created_at (TIMESTAMP)
└── UNIQUE(list_id, user_id)

migrations (tracking applied migrations)
├── name (VARCHAR PK)
└── applied_at (TIMESTAMP)
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (email, password) |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/google` | Google OAuth exchange |

### Lists (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lists` | Get owned + shared lists |
| POST | `/api/lists` | Create list |
| PUT | `/api/lists/:id` | Update list (owner/edit) |
| DELETE | `/api/lists/:id` | Delete list (owner only) |

### Items (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lists/:listId/items` | Get items for list |
| POST | `/api/lists/:listId/items` | Create item (supports parent_id) |
| PUT | `/api/items/:id` | Update item (supports cross-list move) |
| DELETE | `/api/items/:id` | Delete item |

### Sharing (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lists/:id/share` | Share list (owner only) |
| GET | `/api/lists/:id/shares` | Get shares |
| DELETE | `/api/lists/:listId/shares/:userId` | Revoke share (owner) |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/security-status` | Security config status |

## Real-Time Events (Socket.io)

### Rooms
Each list has a room: `list-{listId}`. Users auto-join rooms for accessible lists on connect.

### Events
| Event | Trigger | Payload |
|-------|---------|---------|
| `list-created` | New list created | Full list object |
| `list-updated` | List modified | Updated list |
| `list-deleted` | List deleted | `{id}` |
| `item-created` | Item added | `{listId, item}` |
| `item-updated` | Item modified | `{listId, item}` |
| `item-deleted` | Item deleted | `{listId, itemId}` |
| `items-refresh` | Cross-list move | `{listId}` (triggers refetch) |
| `list-shared` | List shared | `{listId, userId, permission}` |
| `share-removed` | Share revoked | `{listId, userId}` |

## Permission Model

| Level | Can View | Can Edit Items | Can Delete List | Can Move Items Out |
|-------|----------|---------------|-----------------|-------------------|
| Owner | ✓ | ✓ | ✓ | ✓ |
| Edit | ✓ | ✓ | ✗ | ✗ |
| View | ✓ | ✗ | ✗ | ✗ |

## Development Workflow

### Start Development Environment
```bash
cp .env.example .env
docker-compose up -d
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# Database: localhost:5432
```

### Run Tests
```bash
# Docker (isolated)
docker compose --profile test run --rm backend-test

# Local
cd backend && npm test
cd backend && npm run test:watch  # watch mode
```

### Production Deployment (Auto SSL)
```bash
cp .env.production.example .env
# Edit .env: DOMAIN, ACME_EMAIL, DB_PASSWORD, JWT_SECRET
./deploy-simple.sh
```

## Key Patterns & Conventions

### Frontend State Management
- All state via React hooks (useState, useEffect, useRef, useMemo)
- No Redux/Context - RealtimeApp is monolithic
- localStorage for auth persistence: `token`, `user`
- Optimistic updates with temp IDs (`temp-{timestamp}`)
- Debounced notes saving (500ms via useRef timeout)
- Rate-limited fetchLists (5s minimum between calls)

### Backend Patterns
- Raw parameterized SQL queries (no ORM)
- Connection pooling via `pg.Pool`
- Transactions for cross-list moves: `BEGIN`/`COMMIT`/`ROLLBACK`
- Recursive CTE for moving item hierarchies
- Generic error messages to prevent user enumeration

### Security Implementation
- JWT tokens (24h expiry) in Authorization header
- bcrypt password hashing (10 rounds)
- Rate limiting: 500 req/15min (API), 10 req/15min (auth)
- Input sanitization: removes `<>"'`;(){}[]\``, max 1000 chars
- Password requirements: 8+ chars, upper, lower, number
- CSRF token header (X-CSRF-Token) for non-GET requests
- Security headers: X-Content-Type-Options, X-Frame-Options, HSTS

### Position Calculation (Drag & Drop)
- Integer positions with large gaps (GAP = 1000)
- New items: `COALESCE(MAX(position), 0) + GAP`
- Insert between: `floor((prev + next) / 2)` or `prev + 1` if no room
- Cross-list: reset position to target list's next available

### Item Hierarchy
- `parent_id` references another item in same list
- Depth indentation: 24px per level
- Max visual depth styling: 3 levels (gray/blue/green borders)
- Shift+drag or 40px rightward drag nests as child
- Deleting parent cascades to children (FK constraint)

## Environment Variables

### Development (.env)
```
DB_HOST=postgres
DB_PORT=5432
DB_NAME=listapp
DB_USER=listuser
DB_PASSWORD=changeme-in-production
JWT_SECRET=change-this-to-a-long-random-string-in-production
PORT=3001
GOOGLE_CLIENT_ID=optional
FRONTEND_PORT=3000
```

### Production (.env)
```
DOMAIN=collaborlist.com
ACME_EMAIL=your-email@example.com
DB_NAME=listapp
DB_USER=listuser
DB_PASSWORD=strong-random-password
JWT_SECRET=32-char-random-string
GOOGLE_CLIENT_ID=optional
```

## Testing Strategy

- **Framework**: Jest + Supertest
- **Pattern**: Unit tests with mocked database (no real DB in tests)
- **Location**: `backend/__tests__/*.test.js`
- **Coverage**: Cross-list moves, permissions, transactions, input validation
- **Config**: Sequential execution (`--runInBand`), auto mock clearing

### Test Structure
```javascript
describe('Feature', () => {
  beforeEach(() => {
    // Reset mocks, create fresh pool/client mocks
    // Generate fresh JWT token
  });

  test('should...', async () => {
    mockPool.query.mockResolvedValueOnce({...});
    const response = await request(app).put(...);
    expect(response.status).toBe(200);
  });
});
```

## Common Tasks

### Add a new API endpoint
1. Add route in `backend/server.js`
2. Use `authenticateToken` middleware for protected routes
3. Check permissions via SQL joins on `list_shares`
4. Emit WebSocket event via `io.to(`list-${listId}`).emit(...)`

### Add a new database column
1. Add migration to `migrations` array in `server.js`
2. Use `IF NOT EXISTS` for idempotency
3. Update relevant API endpoints to handle new field
4. Update frontend state and UI

### Add a new real-time event
1. Emit from backend: `io.to(`list-${listId}`).emit('event-name', payload)`
2. Handle in frontend `useEffect` socket listener
3. Update local state accordingly

### Modify frontend UI
1. Edit `frontend/src/RealtimeApp.jsx`
2. Use Tailwind utility classes
3. Add state via useState if needed
4. Handle API calls with axios (auth header auto-added)

## Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Ensure postgres container is running: `docker-compose ps`
- Check health: `docker-compose logs postgres`

**"Token expired" / 401 errors**
- JWT expires after 24h
- Frontend auto-logs out on 401/403

**Real-time updates not working**
- Check WebSocket connection status in UI header
- Verify backend logs for socket connection
- Ensure user is authenticated (socket requires JWT)

**Cross-list move fails**
- Only list owners can move items out
- Must have edit permission on target list
- Check backend logs for permission errors

## Architecture Notes

### Why Monolithic Frontend?
RealtimeApp.jsx is intentionally large (~1800 lines) to:
- Keep all real-time logic centralized
- Avoid prop drilling with WebSocket state
- Simplify optimistic update rollback logic
Trade-off: Could be refactored into components for maintainability at scale.

### Why Raw SQL?
- Full control over complex queries (recursive CTEs)
- Transactions for atomic cross-list moves
- No ORM overhead
Trade-off: More verbose, requires careful parameterization.

### Why In-Memory Rate Limiting?
- Simple deployment (no Redis dependency)
- Sufficient for single-instance deployment
Trade-off: Resets on restart, doesn't scale horizontally.
