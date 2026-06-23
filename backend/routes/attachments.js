'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { getItemAccess } = require('../services/itemAccess');
const attachmentService = require('../services/attachmentService');
const { UPLOAD_DIR } = require('../lib/uploads');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

module.exports = (authenticateToken, upload) => {
  const router = express.Router();

  // POST /items/:id/attachments — multipart single 'file'. Auth via header.
  router.post('/items/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const access = await getItemAccess(pool, req.params.id, req.user.id);
      if (!access.found)   { cleanup(req.file); return res.status(404).json({ error: 'Item not found' }); }
      if (!access.canEdit) { cleanup(req.file); return res.status(403).json({ error: 'No edit permission' }); }
      if (!req.file)       return res.status(400).json({ error: 'No valid file (allowed: jpeg, png, gif, webp, pdf; max 10MB)' });

      const row = await attachmentService.create(pool, {
        itemId: Number(req.params.id),
        uploaderId: req.user.id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storageKey: req.file.filename,
      });
      res.status(201).json(row);
    } catch (e) {
      cleanup(req.file);
      console.error('POST attachments error:', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // GET /items/:id/attachments
  router.get('/items/:id/attachments', authenticateToken, async (req, res) => {
    try {
      const access = await getItemAccess(pool, req.params.id, req.user.id);
      if (!access.found)   return res.status(404).json({ error: 'Item not found' });
      if (!access.canView) return res.status(403).json({ error: 'Not authorized' });
      res.json(await attachmentService.listForItem(pool, req.params.id));
    } catch (e) {
      console.error('GET attachments error:', e);
      res.status(500).json({ error: 'Failed to list attachments' });
    }
  });

  // GET /attachments/:id/download — auth via header OR ?token= (for <img>/anchor)
  router.get('/attachments/:id/download', async (req, res) => {
    try {
      const user = resolveUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const att = await attachmentService.getById(pool, req.params.id);
      if (!att) return res.status(404).json({ error: 'Not found' });
      const access = await getItemAccess(pool, att.item_id, user.id);
      if (!access.found || !access.canView) return res.status(403).json({ error: 'Not authorized' });

      const filePath = path.join(UPLOAD_DIR, att.storage_key);
      res.setHeader('Content-Type', att.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${att.filename.replace(/["\r\n]/g, '')}"`);
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => { if (!res.headersSent) res.status(404).json({ error: 'File missing' }); });
      stream.pipe(res);
    } catch (e) {
      console.error('GET download error:', e);
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // DELETE /attachments/:id — uploader or item editor
  router.delete('/attachments/:id', authenticateToken, async (req, res) => {
    try {
      const att = await attachmentService.getById(pool, req.params.id);
      if (!att) return res.status(404).json({ error: 'Not found' });
      const access = await getItemAccess(pool, att.item_id, req.user.id);
      if (!access.found)   return res.status(404).json({ error: 'Item not found' });
      if (!access.canEdit) return res.status(403).json({ error: 'No edit permission' });

      const removed = await attachmentService.remove(pool, req.params.id);
      if (removed) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR, removed.storage_key)); }
        catch (e) { console.error('attachment file unlink failed (non-fatal):', e.message); }
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('DELETE attachment error:', e);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  function resolveUser(req) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
  }
  function cleanup(file) {
    if (file && file.path) { try { fs.unlinkSync(file.path); } catch (_) {} }
  }

  return router;
};
