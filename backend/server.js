const express = require('express');
const cors = require('cors');
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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Security configuration
const { createSecurityMiddleware } = require('./security');

// PostgreSQL connection
const pool = require('./db/pool');
const { runMigrations } = require('./db/migrations');

// Real-time modules
const presence = require('./realtime/presence');
const events = require('./realtime/events');

// Middleware and Security
app.use(express.json());
const { validateEmail, sanitizeInput } = createSecurityMiddleware(app, cors, JWT_SECRET);

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

/**
 * Broadcast the current presence snapshot to all workspace rooms the socket
 * belongs to. Best-effort — errors are swallowed so a presence broadcast never
 * crashes a socket handler.
 * @param {import('socket.io').Socket} socket
 * @param {number[]} workspaceIds  Pre-captured list of workspace ids for this user.
 */
async function broadcastPresence(socket, workspaceIds) {
  try {
    const snap = presence.snapshot();
    for (const wsId of workspaceIds) {
      io.to(`workspace-${wsId}`).emit(events.PRESENCE_UPDATE, snap);
    }
  } catch (err) {
    console.error('Error broadcasting presence:', err);
  }
}

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
    console.error('Error joining list rooms:', error);
  }

  // Join rooms for all workspaces the user is a member of.
  // Capture workspace ids so they are available in the disconnect handler
  // (where the socket may already be leaving rooms).
  let workspaceIds = [];
  try {
    const wsRooms = await pool.query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = $1',
      [socket.userId]
    );
    for (const row of wsRooms.rows) {
      socket.join(`workspace-${row.workspace_id}`);
      workspaceIds.push(row.workspace_id);
      console.log(`User ${socket.userEmail} joined room workspace-${row.workspace_id}`);
    }
  } catch (error) {
    console.error('Error joining workspace rooms:', error);
  }

  // Mark user online and broadcast updated presence to their workspaces
  presence.setOnline(socket.userId, socket.userEmail);
  broadcastPresence(socket, workspaceIds);

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

  // Presence: user navigated to a list
  socket.on('presence-list', (listId) => {
    presence.setCurrentList(socket.userId, listId);
    broadcastPresence(socket, workspaceIds);
  });

  // Typing indicator: relay directly to the list room (not stored in presence)
  socket.on('typing', ({ listId, isTyping }) => {
    io.to(`list-${listId}`).emit(events.TYPING, {
      userId: socket.userId,
      email: socket.userEmail,
      listId: Number(listId),
      isTyping: !!isTyping,
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.userEmail} disconnected`);
    presence.setOffline(socket.userId);
    broadcastPresence(socket, workspaceIds);
  });
});

// Helper function to emit updates
const emitListUpdate = (listId, event, data) => {
  io.to(`list-${listId}`).emit(event, data);
};

const emitWorkspaceUpdate = (workspaceId, event, data) => {
  io.to(`workspace-${workspaceId}`).emit(event, data);
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

// Security status check (only shows configuration, not secrets)
app.get('/api/security-status', (req, res) => {
  res.json({
    googleOAuth: GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('your-') ? 'configured' : 'not configured',
    signupMethod: GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('your-') ? 'google-only' : 'email-password',
    jwtSecure: JWT_SECRET !== 'your-secret-key-change-in-production',
    rateLimiting: 'enabled',
    csrfProtection: 'enabled',
    cors: 'configured',
    securityHeaders: 'enabled',
    tokenExpiry: '24h',
    passwordRequirements: {
      minLength: 8,
      requiresUppercase: true,
      requiresLowercase: true,
      requiresNumber: true
    }
  });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  // Disable regular signup if Google OAuth is configured
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('your-') && GOOGLE_CLIENT_ID !== '') {
    return res.status(403).json({
      error: 'Registration is currently disabled. Please use Google Sign-In instead.'
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Check if user exists (but don't reveal this to the user)
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      // Generic error to prevent user enumeration
      return res.status(400).json({ error: 'Unable to create account. Please try again or use a different email.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );

    const user = result.rows[0];
    try { await require('./services/workspaceService').provisionNewUser(pool, user.id); }
    catch (e) { console.error('Failed to provision workspace for new user:', e); }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Use same generic error for both cases to prevent user enumeration
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      // Same generic error message
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

// Google OAuth login endpoint
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  // Check if Google OAuth is configured
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === '' || GOOGLE_CLIENT_ID.includes('your-')) {
    return res.status(501).json({
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment variables.'
    });
  }

  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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
      // Create new user with Google OAuth (no password required)
      const result = await pool.query(
        'INSERT INTO users (email, google_id, password_hash) VALUES ($1, $2, $3) RETURNING id, email',
        [email, googleId, 'google-oauth-no-password']
      );
      user = result;
      try { await require('./services/workspaceService').provisionNewUser(pool, user.rows[0].id); }
      catch (e) { console.error('Failed to provision workspace for new Google user:', e); }
    } else if (!user.rows[0].google_id) {
      // Link existing account with Google
      await pool.query(
        'UPDATE users SET google_id = $1 WHERE email = $2',
        [googleId, email]
      );
    }

    const token = jwt.sign({
      id: user.rows[0].id,
      email: user.rows[0].email
    }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.rows[0].id, email: user.rows[0].email } });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// Lists Routes (protected) with real-time updates
app.get('/api/lists', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*,
              CASE WHEN l.user_id = $1 THEN true ELSE false END AS is_owner,
              CASE
                WHEN l.user_id = $1 THEN 'owner'
                ELSE COALESCE(ls.permission, 'view')
              END AS user_permission
       FROM lists l
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $1
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
  let { name, description, project_id } = req.body;

  // Sanitize inputs
  name = sanitizeInput(name);
  description = sanitizeInput(description || '');

  if (!name || name.length < 1) {
    return res.status(400).json({ error: 'List name is required' });
  }

  // Validate optional project_id: caller must be a member of the project's workspace
  if (project_id) {
    const { getWorkspaceIdForProject } = require('./services/projectService');
    const { getWorkspaceRole } = require('./middleware/permissions');
    const wsId = await getWorkspaceIdForProject(pool, project_id);
    if (!wsId || !(await getWorkspaceRole(pool, wsId, req.user.id))) {
      return res.status(403).json({ error: 'No access to that project' });
    }
  }

  try {
    const result = await pool.query(
      'INSERT INTO lists (name, description, user_id, project_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, req.user.id, project_id || null]
    );

    const newList = result.rows[0];
    newList.is_owner = true;
    newList.user_permission = 'owner';

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
  let { name, description, project_id } = req.body;

  // Sanitize inputs
  name = sanitizeInput(name);
  description = sanitizeInput(description);

  try {
    // Check list edit permissions FIRST before any project_id validation
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

    // Validate optional project_id: if provided (and not null), caller must be a member of that project's workspace.
    // This check runs AFTER confirming the caller has list-edit rights to prevent workspace membership probing.
    if (project_id !== undefined && project_id !== null) {
      const { getWorkspaceIdForProject } = require('./services/projectService');
      const { getWorkspaceRole } = require('./middleware/permissions');
      const wsId = await getWorkspaceIdForProject(pool, project_id);
      if (!wsId || !(await getWorkspaceRole(pool, wsId, req.user.id))) {
        return res.status(403).json({ error: 'No access to that project' });
      }
    }

    // Build update query — project_id in body overrides existing value (null = unassign)
    let result;
    if (project_id !== undefined) {
      result = await pool.query(
        'UPDATE lists SET name = $1, description = $2, project_id = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
        [name, description, project_id === null ? null : project_id, id]
      );
    } else {
      result = await pool.query(
        'UPDATE lists SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [name, description, id]
      );
    }

    const updatedList = result.rows[0];
    const isOwner = updatedList.user_id === req.user.id;
    updatedList.is_owner = isOwner;
    updatedList.user_permission = isOwner ? 'owner' : 'edit';

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
      // Generic error - don't reveal if user exists
      return res.status(400).json({ error: 'Unable to share list. Please check the email address.' });
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

// Item collaboration field constants and helpers
const VALID_ITEM_STATUSES = ['To do', 'Doing', 'Done', 'Blocked'];

/**
 * Returns true if assigneeId is a valid assignee for the given list.
 * For project-linked lists: assignee must be a workspace_members row for the project's workspace.
 * For standalone lists: assignee must be the list owner or a list_shares entry.
 * Null assignee is always valid (used for unassign).
 */
async function validateAssignee(listId, assigneeId) {
  const r = await pool.query(
    `SELECT 1 FROM lists l
     WHERE l.id = $1
       AND l.project_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM workspace_members wm
         JOIN projects p ON p.workspace_id = wm.workspace_id
         WHERE p.id = l.project_id AND wm.user_id = $2
       )
     UNION ALL
     SELECT 1 FROM lists l
     WHERE l.id = $1
       AND l.project_id IS NULL
       AND (l.user_id = $2 OR EXISTS (
         SELECT 1 FROM list_shares ls WHERE ls.list_id = l.id AND ls.user_id = $2
       ))`,
    [listId, assigneeId]
  );
  return r.rows.length > 0;
}

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
  let { text, completed = false, notes = '', parent_id = null,
        assignee_id = null, due_date = null, status } = req.body;

  // Sanitize input
  text = sanitizeInput(text);

  if (!text || text.length < 1) {
    return res.status(400).json({ error: 'Item text is required' });
  }

  // Status/completed sync at write time
  if (status !== undefined) {
    if (!VALID_ITEM_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    completed = (status === 'Done');
  } else {
    status = completed ? 'Done' : 'To do';
  }

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

    // Validate assignee_id when not null
    if (assignee_id !== null) {
      const validAssignee = await validateAssignee(listId, assignee_id);
      if (!validAssignee) {
        return res.status(400).json({ error: 'Invalid assignee' });
      }
    }

    // If parent_id is provided, verify it exists and belongs to the same list
    if (parent_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM list_items WHERE id = $1 AND list_id = $2',
        [parent_id, listId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid parent item' });
      }
    }

    // Calculate position based on parent context
    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM list_items WHERE list_id = $1 AND parent_id IS NOT DISTINCT FROM $2',
      [listId, parent_id]
    );
    const nextPosition = posResult.rows[0].next_position;

    const result = await pool.query(
      `INSERT INTO list_items (list_id, text, completed, position, notes, parent_id, assignee_id, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [listId, text, completed, nextPosition, notes, parent_id, assignee_id, due_date, status]
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
  let { text, completed, position, notes, parent_id, list_id: requestedListId,
        assignee_id, due_date, status } = req.body;

  // Sanitize text input if provided
  if (text !== undefined) {
    text = sanitizeInput(text);
    if (text.length < 1) {
      return res.status(400).json({ error: 'Item text cannot be empty' });
    }
  }

  // Validate status early (before DB calls)
  if (status !== undefined && !VALID_ITEM_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (requestedListId !== undefined && requestedListId !== null) {
    const parsed = parseInt(requestedListId, 10);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ error: 'Invalid target list' });
    }
    requestedListId = parsed;
  }

  try {
    // Check edit permission through list; also capture prior assignee/completed for activity recording
    const permCheck = await pool.query(
      `SELECT l.user_id, ls.permission, li.list_id,
              li.assignee_id AS prev_assignee_id, li.completed AS prev_completed
       FROM list_items li
       JOIN lists l ON li.list_id = l.id
       LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
       WHERE li.id = $1`,
      [id, req.user.id]
    );

    if (permCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const isSourceOwner = permCheck.rows[0].user_id === req.user.id;
    const canEdit = isSourceOwner || permCheck.rows[0].permission === 'edit';

    if (!canEdit) {
      return res.status(403).json({ error: 'No edit permission' });
    }

    const originalListId = permCheck.rows[0].list_id;
    const prev_assignee_id = permCheck.rows[0].prev_assignee_id;
    const prev_completed   = permCheck.rows[0].prev_completed;
    let targetListId = originalListId;
    let isCrossListMove = false;

    if (requestedListId !== undefined && requestedListId !== originalListId) {
      if (!isSourceOwner) {
        return res.status(403).json({ error: 'Only list owners can move items to other lists' });
      }

      const targetCheck = await pool.query(
        `SELECT l.user_id, ls.permission
         FROM lists l
         LEFT JOIN list_shares ls ON l.id = ls.list_id AND ls.user_id = $2
         WHERE l.id = $1`,
        [requestedListId, req.user.id]
      );

      if (targetCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Target list not found' });
      }

      const targetOwnerId = targetCheck.rows[0].user_id;
      const targetPermission = targetCheck.rows[0].permission;
      const canAddToTarget = targetOwnerId === req.user.id || targetPermission === 'edit';

      if (!canAddToTarget) {
        return res.status(403).json({ error: 'No edit permission on target list' });
      }

      targetListId = requestedListId;
      isCrossListMove = true;

      if (parent_id === undefined) {
        parent_id = null;
      }
    }

    const parentValidationListId = isCrossListMove ? targetListId : originalListId;

    if (parent_id !== undefined && parent_id !== null) {
      const parentCheck = await pool.query(
        'SELECT id FROM list_items WHERE id = $1 AND list_id = $2',
        [parent_id, parentValidationListId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid parent item' });
      }
      if (parent_id == id) {
        return res.status(400).json({ error: 'Item cannot be its own parent' });
      }
    }

    // Validate assignee_id AFTER permission check (do not leak existence before authz)
    if (assignee_id !== undefined && assignee_id !== null) {
      const validAssignee = await validateAssignee(targetListId, assignee_id);
      if (!validAssignee) {
        return res.status(400).json({ error: 'Invalid assignee' });
      }
    }

    if (isCrossListMove) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM list_items WHERE list_id = $1 AND parent_id IS NOT DISTINCT FROM $2',
        [targetListId, parent_id === undefined ? null : parent_id]
      );
      position = posResult.rows[0].next_position;
    }

    let query = 'UPDATE list_items SET updated_at = NOW()';
    const params = [];
    let paramCount = 1;

    if (text !== undefined) {
      query += `, text = $${paramCount++}`;
      params.push(text);
    }
    // Status/completed write-time sync
    if (status !== undefined) {
      // status provided: status wins — always derive completed from status
      query += `, status = $${paramCount++}`;
      params.push(status);
      query += `, completed = $${paramCount++}`;
      params.push(status === 'Done');
    } else if (completed !== undefined) {
      // Only completed provided: sync status too
      query += `, status = $${paramCount++}`;
      params.push(completed ? 'Done' : 'To do');
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
    if (parent_id !== undefined) {
      query += `, parent_id = $${paramCount++}`;
      params.push(parent_id);
    }
    if (requestedListId !== undefined) {
      query += `, list_id = $${paramCount++}`;
      params.push(targetListId);
    }
    if (assignee_id !== undefined) {
      query += `, assignee_id = $${paramCount++}`;
      params.push(assignee_id);
    }
    if (due_date !== undefined) {
      query += `, due_date = $${paramCount++}`;
      params.push(due_date);
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    let updatedItem;

    // Use transaction for cross-list moves to ensure atomicity
    if (isCrossListMove) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update the main item
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Item not found' });
        }

        // Move all descendants to the target list
        await client.query(
          `WITH RECURSIVE subtree AS (
             SELECT id FROM list_items WHERE id = $1
             UNION
             SELECT li.id
             FROM list_items li
             JOIN subtree s ON li.parent_id = s.id
           )
           UPDATE list_items
           SET list_id = $2
           WHERE id IN (SELECT id FROM subtree)`,
          [id, targetListId]
        );

        // Get the updated item with all changes
        const refreshedItem = await client.query('SELECT * FROM list_items WHERE id = $1', [id]);
        updatedItem = refreshedItem.rows[0];

        await client.query('COMMIT');

        // Emit updates after successful transaction
        emitListUpdate(originalListId, 'items-refresh', { listId: originalListId });
        emitListUpdate(targetListId, 'items-refresh', { listId: targetListId });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Simple update without transaction for non-cross-list changes
      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      updatedItem = result.rows[0];
      emitListUpdate(targetListId, 'item-updated', { listId: targetListId, item: updatedItem });

      // Best-effort activity recording — never fail the item update if this throws
      try {
        const activitySvc = require('./services/activityService');
        const events_catalog = require('./realtime/events');
        const { workspaceId, projectId } = await activitySvc.projectContextForList(pool, targetListId);
        if (workspaceId) {
          const evts = activitySvc.itemActivityEvents(
            { assignee_id: prev_assignee_id, completed: prev_completed },
            updatedItem,
            req.user.id
          );
          for (const e of evts) {
            const row = await activitySvc.record(pool, {
              workspaceId,
              projectId,
              actorId: req.user.id,
              verb: e.verb,
              target: e.target,
              meta: e.meta,
            });
            emitWorkspaceUpdate(workspaceId, events_catalog.ACTIVITY_CREATED, row);
          }
        }
      } catch (actErr) {
        console.error('Activity recording error (non-fatal):', actErr);
      }
    }

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

// Item tagging endpoints
const tagSvc = require('./services/tagService');

app.post('/api/items/:id/tags', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { tag_id } = req.body;

  if (!tag_id) return res.status(400).json({ error: 'tag_id required' });

  try {
    // Mirror PUT /api/items/:id permission check: caller must own or have edit access to the item's list
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

    await tagSvc.addToItem(pool, id, tag_id);
    res.status(201).json({ item_id: parseInt(id, 10), tag_id });
  } catch (error) {
    console.error('Error adding tag to item:', error);
    res.status(500).json({ error: 'Failed to add tag to item' });
  }
});

app.delete('/api/items/:id/tags/:tagId', authenticateToken, async (req, res) => {
  const { id, tagId } = req.params;

  try {
    // Mirror PUT /api/items/:id permission check: caller must own or have edit access to the item's list
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

    await tagSvc.removeFromItem(pool, id, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing tag from item:', error);
    res.status(500).json({ error: 'Failed to remove tag from item' });
  }
});

// Workspace routes (V2 hub)
app.use('/api/workspaces', require('./routes/workspaces')(authenticateToken, sanitizeInput));
app.use('/api/projects', require('./routes/projects')(authenticateToken, sanitizeInput));

// Comments routes (V2 — items/:id/comments and comments/:id)
app.use('/api', require('./routes/comments')(authenticateToken, sanitizeInput, { list: emitListUpdate, workspace: emitWorkspaceUpdate }));

// Activity feed routes (V2)
app.use('/api/activity', require('./routes/activity')(authenticateToken, sanitizeInput, { list: emitListUpdate, workspace: emitWorkspaceUpdate }));

// My Tasks route (V2 — assigned items across all accessible lists)
app.use('/api/me', require('./routes/tasks')(authenticateToken));

// Security check for production environment
function checkProductionSecurity() {
  if (process.env.NODE_ENV === 'production') {
    const errors = [];

    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
      errors.push('JWT_SECRET must be configured in production');
    }

    if (!process.env.FRONTEND_URL) {
      errors.push('FRONTEND_URL should be configured for proper CORS in production');
    }

    if (errors.length > 0) {
      console.error('🔴 SECURITY CONFIGURATION ERRORS:');
      errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log('✅ Security checks passed for production environment');
  }
}

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

    // Run migrations after tables are created
    await runMigrations();
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run security checks before starting
checkProductionSecurity();

initializeDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server with auth and real-time updates is running on port ${PORT}`);
    console.log(`Security status: ${GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('your-') ? 'Google OAuth enabled (signup disabled)' : 'Traditional auth enabled'}`);
  });
});
