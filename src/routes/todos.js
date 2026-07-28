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

const VALID_PRIORITIES = [1, 2, 3];

// priorityのバリデーション（1・2・3の整数のみ許可）
function validatePriority(priority) {
  if (typeof priority !== 'number' || !VALID_PRIORITIES.includes(priority)) {
    return { error: 'priority は 1, 2, 3 のいずれかで指定してください' };
  }
  return { value: priority };
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

// TODO一覧を取得（?completed=true|false・?search=キーワード・?priority=1|2|3 で絞り込み可能。組み合わせ可）
router.get('/', async (req, res) => {
  // 1. クエリパラメータからcompleted・search・priorityを受け取る
  const { completed, search, priority } = req.query;

  if (completed !== undefined && completed !== 'true' && completed !== 'false') {
    return res.status(400).json({ error: 'completed は true または false で指定してください' });
  }
  if (priority !== undefined && !['1', '2', '3'].includes(priority)) {
    return res.status(400).json({ error: 'priority は 1, 2, 3 のいずれかで指定してください' });
  }

  // 2. 指定された条件だけをWHERE句に組み立てる（パラメータ化クエリでSQLインジェクションを防ぐ）
  const whereClauses = [];
  const values = [];
  let paramIndex = 1;

  if (completed !== undefined) {
    whereClauses.push(`completed = $${paramIndex++}`);
    values.push(completed === 'true');
  }
  if (search !== undefined && search.trim() !== '') {
    // titleに検索語が1文字でも含まれていればヒットするあいまい検索（ILIKEは大文字小文字を区別しない部分一致）
    whereClauses.push(`title ILIKE $${paramIndex++}`);
    values.push(`%${search.trim()}%`);
  }
  if (priority !== undefined) {
    whereClauses.push(`priority = $${paramIndex++}`);
    values.push(Number(priority));
  }
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    // 3. 組み立てた条件で絞り込んだ結果を取得する（条件が無ければ全件取得と同じSQLになる）
    const result = await pool.query(
      `SELECT id, title, completed, priority, created_at, updated_at FROM todos ${whereSql} ORDER BY id`,
      values
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
      'SELECT id, title, completed, priority, created_at, updated_at FROM todos WHERE id = $1',
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
  // 1. リクエストボディからtitleとpriorityを受け取る
  const { title, priority } = req.body;
  // 2. titleが正しい値か判別する（空文字・文字数超過などを弾く）
  const validatedTitle = validateTitle(title);
  if (validatedTitle.error) {
    return res.status(400).json({ error: validatedTitle.error });
  }

  // 3. priorityが送られてきていれば判別する（未指定ならDBのDEFAULTに任せる）
  const columns = ['title'];
  const values = [validatedTitle.value];
  if (priority !== undefined) {
    const validatedPriority = validatePriority(priority);
    if (validatedPriority.error) {
      return res.status(400).json({ error: validatedPriority.error });
    }
    columns.push('priority');
    values.push(validatedPriority.value);
  }
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  try {
    // 4. 組み立てたカラムだけをDBに新規登録する
    const result = await pool.query(
      `INSERT INTO todos (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, title, completed, priority, created_at, updated_at`,
      values
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

  const { title, completed, priority } = req.body;

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
  if (priority !== undefined) {
    const validatedPriority = validatePriority(priority);
    if (validatedPriority.error) {
      return res.status(400).json({ error: validatedPriority.error });
    }
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
  if (priority !== undefined) {
    setClauses.push(`priority = $${paramIndex++}`);
    values.push(priority);
  }
  setClauses.push('updated_at = now()');
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE todos SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, title, completed, priority, created_at, updated_at`,
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
