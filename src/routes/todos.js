const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

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

// :id が数値形式かどうかをチェックする
function parseId(rawId) {
  if (!/^\d+$/.test(rawId)) {
    return null;
  }
  return Number(rawId);
}

// TODO一覧を取得（?completed=true|false で絞り込み可能）
router.get('/', async (req, res) => {
  const { completed } = req.query;

  try {
    if (completed === undefined) {
      const result = await pool.query(
        'SELECT id, title, completed, created_at, updated_at FROM todos ORDER BY id'
      );
      return res.json(result.rows);
    }

    if (completed !== 'true' && completed !== 'false') {
      return res.status(400).json({ error: 'completed は true または false で指定してください' });
    }

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
  const { title } = req.body;
  const validated = validateTitle(title);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  try {
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
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(404).json({ error: 'TODOが見つかりません' });
  }

  const { title, completed } = req.body;

  if (title !== undefined) {
    const validated = validateTitle(title);
    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed は真偽値で指定してください' });
  }

  // 指定されたフィールドのみを更新するSET句を組み立てる（パラメータ化クエリでSQLインジェクションを防ぐ）
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
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(404).json({ error: 'TODOが見つかりません' });
  }

  try {
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'TODOが見つかりません' });
    }
    res.status(204).end();
  } catch (err) {
    console.error('TODOの削除に失敗しました:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
