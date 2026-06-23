'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024;

function isAllowedMime(mime) { return ALLOWED_MIME.has(mime); }

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { ensureUploadDir(); cb(null, UPLOAD_DIR); } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (isAllowedMime(file.mimetype)) cb(null, true);
    else cb(null, false); // rejected silently; route returns 400 when req.file is absent
  },
});

module.exports = { ALLOWED_MIME, UPLOAD_DIR, MAX_BYTES, isAllowedMime, ensureUploadDir, upload };
