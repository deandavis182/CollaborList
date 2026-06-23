'use strict';
const express = require('express');
const pool = require('../db/pool');
const pushService = require('../services/pushService');
const prefsService = require('../services/prefsService');

module.exports = (authenticateToken) => {
  const router = express.Router();
  router.use(authenticateToken);

  router.get('/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: pushService.publicKey() });
  });

  router.post('/push/subscribe', async (req, res) => {
    try {
      const sub = req.body && req.body.subscription;
      if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }
      await pushService.saveSubscription(pool, req.user.id, { endpoint: sub.endpoint, keys: sub.keys });
      res.status(201).json({ ok: true });
    } catch (e) {
      console.error('POST /push/subscribe error:', e);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });

  router.post('/push/unsubscribe', async (req, res) => {
    try {
      const endpoint = req.body && req.body.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
      await pushService.deleteSubscription(pool, endpoint);
      res.json({ ok: true });
    } catch (e) {
      console.error('POST /push/unsubscribe error:', e);
      res.status(500).json({ error: 'Failed to remove subscription' });
    }
  });

  router.get('/notification-prefs', async (req, res) => {
    try {
      res.json(await prefsService.getPrefs(pool, req.user.id));
    } catch (e) {
      console.error('GET /notification-prefs error:', e);
      res.status(500).json({ error: 'Failed to load prefs' });
    }
  });

  router.put('/notification-prefs', async (req, res) => {
    try {
      res.json(await prefsService.setPrefs(pool, req.user.id, req.body || {}));
    } catch (e) {
      console.error('PUT /notification-prefs error:', e);
      res.status(500).json({ error: 'Failed to save prefs' });
    }
  });

  return router;
};
