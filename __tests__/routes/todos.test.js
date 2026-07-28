// src/routes/todos.js に対するユニットテスト
// supertestでExpressルートに直接リクエストを送って検証する
//
// 各テストは Arrange（準備）→ Act（実行）→ Assert（検証）の順で書く。
// JSは上から順に処理されるため、この順番を崩すと「resが未定義」等のエラーや、
// モック未設定のまま実行して期待と違う結果になる、といった問題が起きる
//
// src/db/pool.js（実DBへの接続）はjest.mockでモックし、
// pool.query の戻り値を各テストで制御することでDB無しでロジックを検証する
// require('../db/pool')の戻り値を、本物のPoolではなく{ query: jest.fn() }に置き換えている
jest.mock('../../src/db/pool', () => ({ query: jest.fn() }));

const express = require('express');
const request = require('supertest');
const pool = require('../../src/db/pool');

function createApp() {
  const todosRouter = require('../../src/routes/todos');
  const app = express();
  app.use(express.json());
  app.use('/todos', todosRouter);
  return app;
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /todos', () => {
  test('正常系：todosテーブルの内容が一覧で返る', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos');

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT');
    expect(params).toEqual([]);
  });

  test('正常系：?completed=true を指定すると完了済みのみで絞り込まれる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 2, title: 'レポートを書く', completed: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ completed: 'true' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE completed = $1');
    expect(params).toEqual([true]);
  });

  test('正常系：?completed=false を指定すると未完了のみで絞り込まれる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ completed: 'false' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual([false]);
  });

  test('異常系：completedにtrue/false以外の値を指定すると400が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).get('/todos').query({ completed: 'yes' });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'completed は true または false で指定してください' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('異常系：DBエラー時は500が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    // Act（実行）
    const res = await request(app).get('/todos');

    // Assert（検証）
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'サーバーエラーが発生しました' });
  });

  test('正常系：?search=キーワード を指定すると、titleに部分一致するものだけ絞り込まれる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ search: '牛乳' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('title ILIKE $1');
    expect(params).toEqual(['%牛乳%']);
  });

  test('エッジケース：searchが1文字でも部分一致すればヒットする', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ search: '牛' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['%牛%']);
  });

  test('正常系：completedとsearchを同時に指定すると両方の条件で絞り込まれる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 2, title: 'レポートを書く', completed: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ completed: 'true', search: 'レポート' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('completed = $1');
    expect(sql).toContain('title ILIKE $2');
    expect(sql).toContain('AND');
    expect(params).toEqual([true, '%レポート%']);
  });

  test('エッジケース：searchが空文字の場合は絞り込みなしの全件取得と同じになる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ search: '' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain('ILIKE');
    expect(params).toEqual([]);
  });

  test('正常系：searchに該当するTODOが無い場合は空配列が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ search: '存在しない単語' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('正常系：?priority=1 を指定すると該当する優先度のみで絞り込まれる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 1, title: '牛乳を買う', completed: false, priority: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ priority: '1' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('priority = $1');
    expect(params).toEqual([1]);
  });

  test('異常系：priorityに1,2,3以外の値を指定すると400が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).get('/todos').query({ priority: '4' });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'priority は 1, 2, 3 のいずれかで指定してください' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('正常系：completed・search・priorityを同時に指定すると全ての条件で絞り込まれる', async () => {
    // Arrange（準備）
    const app = createApp();
    const rows = [
      { id: 2, title: 'レポートを書く', completed: true, priority: 3, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows, rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos').query({ completed: 'true', search: 'レポート', priority: '3' });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('completed = $1');
    expect(sql).toContain('title ILIKE $2');
    expect(sql).toContain('priority = $3');
    expect(params).toEqual([true, '%レポート%', 3]);
  });
});

describe('GET /todos/:id', () => {
  test('正常系：存在するidを指定すると該当TODOが返る', async () => {
    // Arrange（準備）
    const app = createApp();
    const todo = { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    pool.query.mockResolvedValueOnce({ rows: [todo], rowCount: 1 });

    // Act（実行）
    const res = await request(app).get('/todos/1');

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(todo);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE id = $1');
    expect(params).toEqual([1]);
  });

  test('異常系：存在しないidを指定すると404が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Act（実行）
    const res = await request(app).get('/todos/999');

    // Assert（検証）
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'TODOが見つかりません' });
  });

  test('エッジケース：数値でないidを指定すると404が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).get('/todos/abc');

    // Assert（検証）
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'TODOが見つかりません' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('異常系：DBエラー時は500が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    // Act（実行）
    const res = await request(app).get('/todos/1');

    // Assert（検証）
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'サーバーエラーが発生しました' });
  });
});

describe('POST /todos', () => {
  test('正常系：titleを指定するとTODOが作成される', async () => {
    // Arrange（準備）
    const app = createApp();
    const created = { id: 1, title: '牛乳を買う', completed: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    pool.query.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: '牛乳を買う' });

    // Assert（検証）
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
  });

  test('パラメータ化クエリでtitleを渡している（SQLインジェクション対策）', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: "a'; DROP TABLE todos;--", completed: false }], rowCount: 1 });

    // Act（実行）
    await request(app).post('/todos').send({ title: "a'; DROP TABLE todos;--" });

    // Assert（検証）：SQL文字列にtitleの値が直接埋め込まれておらず、プレースホルダとパラメータ配列で渡されていること
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\$1/);
    expect(sql).not.toContain("DROP TABLE");
    expect(params).toEqual(["a'; DROP TABLE todos;--"]);
  });

  test('異常系：titleが無い場合は400が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).post('/todos').send({});

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'title は必須です' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('異常系：titleが空文字の場合は400が返る', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: '' });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'title は必須です' });
  });

  test('異常系：titleが数値など文字列以外の場合は400が返る', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: 123 });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'title は必須です' });
  });

  test('エッジケース：titleが空白文字のみの場合は400が返る', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: '   ' });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'title は必須です' });
  });

  test('異常系：titleが256文字以上の場合は400が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    const longTitle = 'あ'.repeat(256);

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: longTitle });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'title は255文字以内で入力してください' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('エッジケース：titleがちょうど255文字の場合は作成できる', async () => {
    // Arrange（準備）
    const app = createApp();
    const title = 'あ'.repeat(255);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title, completed: false }], rowCount: 1 });

    // Act（実行）
    const res = await request(app).post('/todos').send({ title });

    // Assert（検証）
    expect(res.status).toBe(201);
  });

  test('エッジケース：titleの前後の空白はトリムされて保存される', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: '牛乳を買う', completed: false }], rowCount: 1 });

    // Act（実行）
    await request(app).post('/todos').send({ title: '  牛乳を買う  ' });

    // Assert（検証）：トリム済みの値がクエリのパラメータとして渡されている
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['牛乳を買う']);
  });

  test('異常系：DBエラー時は500が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: '牛乳を買う' });

    // Assert（検証）
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'サーバーエラーが発生しました' });
  });

  test('正常系：priorityを指定するとその値でTODOが作成される', async () => {
    // Arrange（準備）
    const app = createApp();
    const created = { id: 1, title: '牛乳を買う', completed: false, priority: 3, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    pool.query.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: '牛乳を買う', priority: 3 });

    // Assert（検証）
    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('priority');
    expect(params).toEqual(['牛乳を買う', 3]);
  });

  test('正常系：priorityを指定しない場合はSQLにpriority列を含めず、DBのDEFAULTに任せる', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: '牛乳を買う', completed: false, priority: 1 }],
      rowCount: 1,
    });

    // Act（実行）
    await request(app).post('/todos').send({ title: '牛乳を買う' });

    // Assert（検証）：INSERTの列指定部分（RETURNING句より前）にpriorityが含まれていないこと
    const [sql, params] = pool.query.mock.calls[0];
    const insertColumns = sql.split('RETURNING')[0];
    expect(insertColumns).not.toContain('priority');
    expect(params).toEqual(['牛乳を買う']);
  });

  test.each([0, 4, '高', 1.5])('異常系：priorityに%pを指定すると400が返り、DBは呼ばれない', async (invalidPriority) => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).post('/todos').send({ title: '牛乳を買う', priority: invalidPriority });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'priority は 1, 2, 3 のいずれかで指定してください' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('PATCH /todos/:id', () => {
  test('正常系：completedをtrueに更新できる', async () => {
    // Arrange（準備）
    const app = createApp();
    const updated = { id: 1, title: '牛乳を買う', completed: true, updated_at: '2026-01-02T00:00:00.000Z' };
    pool.query.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({ completed: true });

    // Assert（検証）
    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('updated_at = now()');
    expect(params).toEqual([true, 1]);
  });

  test('正常系：titleのみ更新した場合completedはSET句に含まれない（PUT相当の全項目上書きにならない）', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'パンを買う', completed: false }],
      rowCount: 1,
    });

    // Act（実行）
    await request(app).patch('/todos/1').send({ title: 'パンを買う' });

    // Assert（検証）：SET句にcompletedへの代入が含まれていないこと（RETURNING句の列名は含まれてよい）
    const [sql, params] = pool.query.mock.calls[0];
    const setClause = sql.split('WHERE')[0];
    expect(setClause).toContain('title = $1');
    expect(setClause).not.toContain('completed =');
    expect(params).toEqual(['パンを買う', 1]);
  });

  test('異常系：titleを空文字に更新しようとすると400が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({ title: '' });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'title は必須です' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('異常系：completedがboolean以外の場合は400が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({ completed: 'true' });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'completed は真偽値で指定してください' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('異常系：存在しないidを指定すると404が返る（500にならない）', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Act（実行）
    const res = await request(app).patch('/todos/999').send({ completed: true });

    // Assert（検証）
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'TODOが見つかりません' });
  });

  test('エッジケース：数値でないidを指定すると404が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).patch('/todos/abc').send({ completed: true });

    // Assert（検証）
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'TODOが見つかりません' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('エッジケース：更新フィールドを指定しない場合、SET句はupdated_atのみになる', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: '牛乳を買う', completed: false }],
      rowCount: 1,
    });

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({});

    // Assert（検証）
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('updated_at = now()');
    expect(sql).not.toContain('title =');
    expect(params).toEqual([1]);
  });

  test('異常系：DBエラー時は500が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({ completed: true });

    // Assert（検証）
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'サーバーエラーが発生しました' });
  });

  test('正常系：priorityのみ更新できる', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, title: '牛乳を買う', completed: false, priority: 2 }],
      rowCount: 1,
    });

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({ priority: 2 });

    // Assert（検証）
    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('priority = $1');
    expect(params).toEqual([2, 1]);
  });

  test.each([0, 4, '高', 1.5])('異常系：priorityに%pを指定すると400が返り、DBは呼ばれない', async (invalidPriority) => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).patch('/todos/1').send({ priority: invalidPriority });

    // Assert（検証）
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'priority は 1, 2, 3 のいずれかで指定してください' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('DELETE /todos/:id', () => {
  test('正常系：指定したTODOが削除される', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    // Act（実行）
    const res = await request(app).delete('/todos/1');

    // Assert（検証）
    expect(res.status).toBe(204);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM todos'), [1]);
  });

  test('異常系：存在しないidを指定すると404が返る（500にならない）', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Act（実行）
    const res = await request(app).delete('/todos/999');

    // Assert（検証）
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'TODOが見つかりません' });
  });

  test('エッジケース：数値でないidを指定すると404が返り、DBは呼ばれない', async () => {
    // Arrange（準備）
    const app = createApp();

    // Act（実行）
    const res = await request(app).delete('/todos/abc');

    // Assert（検証）
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'TODOが見つかりません' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('異常系：DBエラー時は500が返る', async () => {
    // Arrange（準備）
    const app = createApp();
    pool.query.mockRejectedValueOnce(new Error('DB接続エラー'));

    // Act（実行）
    const res = await request(app).delete('/todos/1');

    // Assert（検証）
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'サーバーエラーが発生しました' });
  });
});
