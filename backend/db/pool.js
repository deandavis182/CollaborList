const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'listapp',
  user: process.env.DB_USER || 'listuser',
  password: process.env.DB_PASSWORD || 'listpass'
});

module.exports = pool;
