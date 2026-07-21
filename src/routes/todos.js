const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
//追記エンドポイントを使うことでデータベースに保存されている完了/未完了の状態で、取得する行を区別している

const TITLE_MAX_LENGTH = 255;

// titleのバリデーション（必須・空文字不可・trim・最大文字数）
function validateTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    return { error: 'title は必須です' };
  }
  const trimmed = title.trim();
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return { error: `title は${TITLE_MAX_LENGTH}文字以内で入力してください` };
  }
  return { value: trimmed };
}
//追記testは文字列が数字で構成されている
//Numberは数値として使える形に変換するためのもの。可読性を上げている。
// :id が数値形式かどうかをチェックする
function parseId(rawId) {
  if (!/^\d+$/.test(rawId)) {
    return null;
  }
  return Number(rawId);
}

// TODO一覧を取得（?completed=true|false で絞り込み可能）
router.get('/', async (req, res) => {
  // 1. クエリパラメータからcompletedを受け取る
  const { completed } = req.query;

  try {
    // 2. completedが指定されていなければ絞り込みなしで全件取得する
    if (completed === undefined) {
      const result = await pool.query(
        'SELECT id, title, completed, created_at, updated_at FROM todos ORDER BY id'
      );
      return res.json(result.rows);
    }

    if (completed !== 'true' && completed !== 'false') {
      return res.status(400).json({ error: 'completed は true または false で指定してください' });
    }

    // 3. completedが指定されていれば、真偽値に変換して絞り込んだ結果を取得する
    const result = await pool.query(
      'SELECT id, title, completed, created_at, updated_at FROM todos WHERE completed = $1 ORDER BY id',
      [completed === 'true']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('TODO一覧の取得に失敗しました:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// TODOを1件取得
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(404).json({ error: 'TODOが見つかりません' });
  }

  try {
    // $1にはidの値だけが入り、SQLの構造自体は書き換えられない（パラメータ化クエリでSQLインジェクションを防ぐ）
    const result = await pool.query(
      'SELECT id, title, completed, created_at, updated_at FROM todos WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'TODOが見つかりません' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('TODOの取得に失敗しました:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// TODOを新規作成
router.post('/', async (req, res) => {
  // 1. リクエストボディからtitleを受け取る
  const { title } = req.body;
  // 2. titleが正しい値か判別する（空文字・文字数超過などを弾く）
  const validated = validateTitle(title);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  try {
    // 3. 2を通過した場合のみDBに新規登録する
    const result = await pool.query(
      'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, completed, created_at, updated_at',
      [validated.value]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('TODOの作成に失敗しました:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// TODOを更新（完了状態やタイトルの変更）
router.patch('/:id', async (req, res) => {
  // 1. idが正しいか判別する
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(404).json({ error: 'TODOが見つかりません' });
  }

  const { title, completed } = req.body;

  // 2. 送られてきた項目だけをチェックする（送られていない項目はチェックをスキップ）
  if (title !== undefined) {
    const validated = validateTitle(title);
    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed は真偽値で指定してください' });
  }

  // 3. 指定されたフィールドのみを更新するSET句を組み立てる（パラメータ化クエリでSQLインジェクションを防ぐ）
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(title.trim());
  }
  if (completed !== undefined) {
    setClauses.push(`completed = $${paramIndex++}`);
    values.push(completed);
  }
  setClauses.push('updated_at = now()');
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE todos SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, title, completed, created_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'TODOが見つかりません' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('TODOの更新に失敗しました:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// TODOを削除
router.delete('/:id', async (req, res) => {
  // 1. idが正しいか判別する
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(404).json({ error: 'TODOが見つかりません' });
  }

  try {
    // 2. DELETE文を実行する
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING id', [id]);
    // 3. 該当する行が無かった場合は404にする
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'TODOが見つかりません' });
    }
    // 4. 成功時は中身を返さず204のみ返す
    res.status(204).end();
  } catch (err) {
    console.error('TODOの削除に失敗しました:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
