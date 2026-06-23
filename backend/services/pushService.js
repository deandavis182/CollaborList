'use strict';
const webpush = require('web-push');

const PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@collaborlist.com';

let enabled = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    enabled = true;
  } catch (e) {
    console.error('pushService: failed to configure VAPID, push disabled:', e.message);
    enabled = false;
  }
} else {
  console.warn('pushService: VAPID keys absent — push notifications disabled (no-op).');
}

function isEnabled() { return enabled; }
function publicKey() { return PUBLIC || null; }

async function saveSubscription(pool, userId, subscription) {
  const { endpoint, keys } = subscription;
  const result = await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys
     RETURNING id`,
    [userId, endpoint, keys]
  );
  return result.rows[0];
}

async function deleteSubscription(pool, endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

async function listForUser(pool, userId) {
  const result = await pool.query(
    'SELECT id, endpoint, keys FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

async function sendToUser(pool, userId, payload) {
  if (!enabled) return { sent: 0, pruned: 0 };
  const subs = await listForUser(pool, userId);
  let sent = 0, pruned = 0;
  const body = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body
      );
      sent++;
    } catch (err) {
      if (err && (err.statusCode === 410 || err.statusCode === 404)) {
        await deleteSubscription(pool, sub.endpoint);
        pruned++;
      } else {
        console.error('pushService.sendToUser send error (non-fatal):', err && err.statusCode, err && err.message);
      }
    }
  }
  return { sent, pruned };
}

module.exports = { isEnabled, publicKey, saveSubscription, deleteSubscription, listForUser, sendToUser };
