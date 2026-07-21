// PostgreSQL接続プール
require('dotenv').config();
const { Pool } = require('pg');

// 同時に複数のリクエストが来ても順番待ちにならないよう、接続を複数本プールして使い回す
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = pool;
