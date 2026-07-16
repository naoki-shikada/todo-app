// PostgreSQLへの接続確認とtodosテーブルの状態チェック
require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  const client = await pool.connect();
  try {
    console.log('接続成功');
    const check = await client.query("SELECT to_regclass('public.todos') AS exists");
    if (!check.rows[0].exists) {
      console.log('todosテーブルは存在しません');
      return;
    }
    const count = await client.query('SELECT COUNT(*) FROM todos');
    console.log(`todosテーブルのレコード数: ${count.rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('接続に失敗しました:', err.message);
  process.exitCode = 1;
});
