const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'listapp',
  user: process.env.DB_USER || 'listuser',
  password: process.env.DB_PASSWORD || 'listpass'
});

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const user = jwt.verify(token, JWT_SECRET);
    socket.userId = user.id;
    socket.userEmail = user.email;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log(`User ${socket.userEmail} connected`);

  // Join rooms for all lists the user has access to
  try {
    const result = await pool.query(
      `SELECT DISTINCT l.id
       FROM lists l
       LEFT JOIN list_shares ls ON l.id = ls.list_id
       WHERE l.user_id = $1 OR ls.user_id = $1`,
      [socket.userId]
    );

    for (const row of result.rows) {
      socket.join(`list-${row.id}`);
      console.log(`User ${socket.userEmail} joined room list-${row.id}`);
    }
  } catch (error) {
    console.error('Error joining rooms:', error);
  }

  // Handle joining a specific list room
  socket.on('join-list', (listId) => {
    socket.join(`list-${listId}`);
    console.log(`User ${socket.userEmail} joined list-${listId}`);
  });

  // Handle leaving a list room
  socket.on('leave-list', (listId) => {
    socket.leave(`list-${listId}`);
    console.log(`User ${socket.userEmail} left list-${listId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.userEmail} disconnected`);
  });
});

// Helper function to emit updates
const emitListUpdate = (listId, event, data) => {
  io.to(`list-${listId}`).emit(event, data);
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', auth: true, realtime: true });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);

    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Google OAuth login endpoint (placeholder)
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  try {
    // Note: In production, you would:
    // 1. Verify the Google token
    // 2. Extract user info
    // 3. Create or update user in database
    // 4. Return JWT token

    // For now, return a message indicating this needs setup
    res.status(501).json({
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment variables and configure OAuth consent screen.'
    });
  } catch (error) {
    console.error('Error with Google login:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

// Lists Routes (protected) with real-time updates
app.get('/api/lists', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT l.*
       FROM lists l
       LEFT JOIN list_shares ls ON l.id = ls.list_id
       WHERE l.user_id = $1 OR ls.user_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

app.post('/api/lists', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO lists (name, description, user_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', req.user.id]
    );

    const newList = result.rows[0];

    // Emit to all users who have access
    emitListUpdate(newList.id, 'list-created', newList);

    res.status(201).json(newList);
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

app.put('/api/lists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    // Check permissions
    const permCheck = await pool.query(
      `SELECT l.user_id, ls.permission
       FROM lists l
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
       WHERE l.id = $1`,
      [id, req.user.id]
    );

    if (permCheck.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const canEdit = permCheck.rows[0].user_id === req.user.id ||
                    permCheck.rows[0].permission === 'edit';

    if (!canEdit) {
      return res.status(403).json({ error: 'No edit permission' });
    }

    const result = await pool.query(
      'UPDATE lists SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, description, id]
    );

    const updatedList = result.rows[0];

    // Emit update to all users viewing this list
    emitListUpdate(id, 'list-updated', updatedList);

    res.json(updatedList);
  } catch (error) {
    console.error('Error updating list:', error);
    res.status(500).json({ error: 'Failed to update list' });
  }
});

app.delete('/api/lists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Only owner can delete
    const result = await pool.query(
      'DELETE FROM lists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to delete this list' });
    }

    // Emit delete event
    emitListUpdate(id, 'list-deleted', { id });

    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// Sharing Routes with notifications
app.post('/api/lists/:id/share', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { email, permission = 'view' } = req.body;

  try {
    // Check if user owns the list
    const ownerCheck = await pool.query(
      'SELECT user_id FROM lists WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to share this list' });
    }

    // Find user by email
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const shareUserId = userResult.rows[0].id;

    // Create or update share
    const result = await pool.query(
      `INSERT INTO list_shares (list_id, user_id, permission)
       VALUES ($1, $2, $3)
       ON CONFLICT (list_id, user_id)
       DO UPDATE SET permission = $3
       RETURNING *`,
      [id, shareUserId, permission]
    );

    // Notify the shared user
    emitListUpdate(id, 'list-shared', {
      listId: id,
      userId: shareUserId,
      permission,
      sharedBy: req.user.email
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sharing list:', error);
    res.status(500).json({ error: 'Failed to share list' });
  }
});

app.get('/api/lists/:id/shares', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user owns the list or has access
    const accessCheck = await pool.query(
      `SELECT l.user_id
       FROM lists l
       WHERE l.id = $1 AND (l.user_id = $2 OR EXISTS (
         SELECT 1 FROM list_shares WHERE list_id = $1 AND user_id = $2
       ))`,
      [id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `SELECT ls.*, u.email
       FROM list_shares ls
       JOIN users u ON ls.user_id = u.id
       WHERE ls.list_id = $1`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shares:', error);
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
});

app.delete('/api/lists/:listId/shares/:userId', authenticateToken, async (req, res) => {
  const { listId, userId } = req.params;

  try {
    // Check if user owns the list
    const ownerCheck = await pool.query(
      'SELECT user_id FROM lists WHERE id = $1',
      [listId]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      'DELETE FROM list_shares WHERE list_id = $1 AND user_id = $2',
      [listId, userId]
    );

    // Notify removed user
    emitListUpdate(listId, 'share-removed', { listId, userId });

    res.json({ message: 'Share removed successfully' });
  } catch (error) {
    console.error('Error removing share:', error);
    res.status(500).json({ error: 'Failed to remove share' });
  }
});

// List Items Routes with real-time updates
app.get('/api/lists/:listId/items', authenticateToken, async (req, res) => {
  const { listId } = req.params;

  try {
    // Check access
    const accessCheck = await pool.query(
      `SELECT 1 FROM lists l
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
       WHERE l.id = $1 AND (l.user_id = $2 OR ls.user_id = $2)`,
      [listId, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1 ORDER BY position, created_at',
      [listId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/lists/:listId/items', authenticateToken, async (req, res) => {
  const { listId } = req.params;
  const { text, completed = false } = req.body;

  try {
    // Check edit permission
    const permCheck = await pool.query(
      `SELECT l.user_id, ls.permission
       FROM lists l
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
       WHERE l.id = $1`,
      [listId, req.user.id]
    );

    if (permCheck.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const canEdit = permCheck.rows[0].user_id === req.user.id ||
                    permCheck.rows[0].permission === 'edit';

    if (!canEdit) {
      return res.status(403).json({ error: 'No edit permission' });
    }

    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM list_items WHERE list_id = $1',
      [listId]
    );
    const nextPosition = posResult.rows[0].next_position;

    const result = await pool.query(
      'INSERT INTO list_items (list_id, text, completed, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [listId, text, completed, nextPosition]
    );

    const newItem = result.rows[0];

    // Emit item created event
    emitListUpdate(listId, 'item-created', { listId, item: newItem });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.put('/api/items/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { text, completed, position, notes } = req.body;

  try {
    // Check edit permission through list
    const permCheck = await pool.query(
      `SELECT l.user_id, ls.permission, li.list_id
       FROM list_items li
       JOIN lists l ON li.list_id = l.id
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
       WHERE li.id = $1`,
      [id, req.user.id]
    );

    if (permCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const canEdit = permCheck.rows[0].user_id === req.user.id ||
                    permCheck.rows[0].permission === 'edit';

    if (!canEdit) {
      return res.status(403).json({ error: 'No edit permission' });
    }

    const listId = permCheck.rows[0].list_id;

    let query = 'UPDATE list_items SET updated_at = NOW()';
    const params = [];
    let paramCount = 1;

    if (text !== undefined) {
      query += `, text = $${paramCount++}`;
      params.push(text);
    }
    if (completed !== undefined) {
      query += `, completed = $${paramCount++}`;
      params.push(completed);
    }
    if (position !== undefined) {
      query += `, position = $${paramCount++}`;
      params.push(position);
    }
    if (notes !== undefined) {
      query += `, notes = $${paramCount++}`;
      params.push(notes);
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    const updatedItem = result.rows[0];

    // Emit item updated event
    emitListUpdate(listId, 'item-updated', { listId, item: updatedItem });

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check edit permission
    const permCheck = await pool.query(
      `SELECT l.user_id, ls.permission, li.list_id
       FROM list_items li
       JOIN lists l ON li.list_id = l.id
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
       WHERE li.id = $1`,
      [id, req.user.id]
    );

    if (permCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const canEdit = permCheck.rows[0].user_id === req.user.id ||
                    permCheck.rows[0].permission === 'edit';

    if (!canEdit) {
      return res.status(403).json({ error: 'No edit permission' });
    }

    const listId = permCheck.rows[0].list_id;

    await pool.query('DELETE FROM list_items WHERE id = $1', [id]);

    // Emit item deleted event
    emitListUpdate(listId, 'item-deleted', { listId, itemId: id });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Initialize database and start server
async function initializeDatabase() {
  try {
    // Run initial schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        google_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS list_items (
        id SERIAL PRIMARY KEY,
        list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS list_shares (
        id SERIAL PRIMARY KEY,
        list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        permission VARCHAR(20) DEFAULT 'view',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(list_id, user_id)
      )
    `);

    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server with auth and real-time updates is running on port ${PORT}`);
  });
});