'use strict';
jest.mock('../services/pushService', () => ({
  publicKey: () => 'TEST_PUBLIC_KEY',
  isEnabled: () => true,
  saveSubscription: jest.fn().mockResolvedValue({ id: 1 }),
  deleteSubscription: jest.fn().mockResolvedValue(undefined),
}));
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const pushService = require('../services/pushService');

const SECRET = process.env.JWT_SECRET || 'test-secret';
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'no token' });
  try { req.user = jwt.verify(t, SECRET); next(); }
  catch { return res.status(401).json({ error: 'bad token' }); }
}

let app, userId, token;
beforeAll(async () => {
  const u = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id`,
    ['push-test@example.com', 'x']
  );
  userId = u.rows[0].id;
  token = jwt.sign({ id: userId, email: 'push-test@example.com' }, SECRET);
  app = express();
  app.use(express.json());
  app.use('/api', require('../routes/push')(authMiddleware));
});
afterAll(async () => {
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM notification_prefs WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

test('GET /push/vapid-public-key returns the key', async () => {
  const r = await request(app).get('/api/push/vapid-public-key').set('Authorization', `Bearer ${token}`);
  expect(r.status).toBe(200);
  expect(r.body.publicKey).toBe('TEST_PUBLIC_KEY');
});
test('POST /push/subscribe validates body and calls saveSubscription', async () => {
  const r = await request(app).post('/api/push/subscribe')
    .set('Authorization', `Bearer ${token}`)
    .send({ subscription: { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } } });
  expect(r.status).toBe(201);
  expect(pushService.saveSubscription).toHaveBeenCalledWith(expect.anything(), userId, { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } });
});
test('POST /push/subscribe 400 on missing endpoint', async () => {
  const r = await request(app).post('/api/push/subscribe').set('Authorization', `Bearer ${token}`).send({ subscription: { keys: {} } });
  expect(r.status).toBe(400);
});
test('GET /notification-prefs returns defaults for a new user', async () => {
  const r = await request(app).get('/api/notification-prefs').set('Authorization', `Bearer ${token}`);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ assignments: true, comments: false });
});
test('PUT /notification-prefs persists a change', async () => {
  const r = await request(app).put('/api/notification-prefs').set('Authorization', `Bearer ${token}`).send({ comments: true });
  expect(r.status).toBe(200);
  expect(r.body.comments).toBe(true);
  const again = await request(app).get('/api/notification-prefs').set('Authorization', `Bearer ${token}`);
  expect(again.body.comments).toBe(true);
});
test('401 without token', async () => {
  const r = await request(app).get('/api/notification-prefs');
  expect(r.status).toBe(401);
});
