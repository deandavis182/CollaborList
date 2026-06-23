// Global setup for integration tests: ensure all DB migrations have been applied
// before any test suite runs. This allows any test file to assume the full V2
// schema exists, regardless of alphabetical execution order.
'use strict';

const { Pool } = require('pg');

module.exports = async function globalSetup() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'listapp',
    user: process.env.DB_USER || 'listuser',
    password: process.env.DB_PASSWORD || 'listpass',
  });

  try {
    // Dynamically require to avoid any server.js side-effects
    const { runMigrations } = require('./db/migrations');
    await runMigrations(pool);
    console.log('[globalSetup] Migrations applied.');
  } finally {
    await pool.end();
  }
};
