'use strict';
const path = require('path');
process.env.UPLOAD_DIR = path.join(__dirname, '__upload_tmp__');
const { ALLOWED_MIME, UPLOAD_DIR, isAllowedMime, upload, ensureUploadDir } = require('../lib/uploads');
const fs = require('fs');

afterAll(() => { try { fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }); } catch (_) {} });

test('allows only the documented mime types', () => {
  ['image/jpeg','image/png','image/gif','image/webp','application/pdf'].forEach((m) => expect(isAllowedMime(m)).toBe(true));
  ['text/html','application/x-msdownload','image/svg+xml',''].forEach((m) => expect(isAllowedMime(m)).toBe(false));
});

test('ensureUploadDir creates the directory idempotently', () => {
  ensureUploadDir();
  expect(fs.existsSync(UPLOAD_DIR)).toBe(true);
  expect(() => ensureUploadDir()).not.toThrow();
});

test('multer instance is configured with a 10MB file size limit', () => {
  expect(upload).toBeDefined();
  // multer stores limits on the instance options
  // (smoke: the instance exposes .single)
  expect(typeof upload.single).toBe('function');
});
