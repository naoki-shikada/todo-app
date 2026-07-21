// db/migrations 配下のSQLファイルを順番に実行するマイグレーションスクリプト
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

async function migrate() {
  // .sortは文字列としての比較なので、実行順序を保証するには常に先頭を001, 002...と同じ桁数で連番にする必要がある
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`実行中: ${file}`);
    await pool.query(sql);
  }

  console.log('マイグレーションが完了しました');
}

migrate()
  .catch((err) => {
    console.error('マイグレーションに失敗しました:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
