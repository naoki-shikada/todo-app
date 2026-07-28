// public/index.html のフロントエンドロジックに対するテスト
// 実HTMLファイルをJSDOMで読み込み、インラインscriptを実際に実行させて検証する
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '../../public/index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// fetchのグローバルモックを生成する（TODOの状態をメモリ上で模擬する）
function createFetchMock(initialTodos) {
  let todos = initialTodos.map((todo) => ({ ...todo }));

  return jest.fn((url, options = {}) => {
    const method = options.method || 'GET';

    if (method === 'GET') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(todos) });
    }

    if (method === 'POST') {
      const body = JSON.parse(options.body);
      todos.push({ id: todos.length + 1, title: body.title, completed: false });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }

    if (method === 'PATCH') {
      const id = Number(url.split('/').pop());
      const body = JSON.parse(options.body);
      const todo = todos.find((t) => t.id === id);
      if (todo) Object.assign(todo, body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }

    if (method === 'DELETE') {
      const id = Number(url.split('/').pop());
      todos = todos.filter((t) => t.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) });
    }

    return Promise.reject(new Error(`未対応のfetch呼び出し: ${method} ${url}`));
  });
}

// index.htmlをJSDOMで読み込み、scriptを実行させたwindowを返す
async function loadPage(fetchMock) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      window.fetch = fetchMock;
    },
  });

  // 初期表示時のfetchTodos()（GET → render）の完了を待つ
  await new Promise((resolve) => setTimeout(resolve, 0));

  return dom;
}

describe('public/index.html のフロントエンドロジック', () => {
  let dom;

  afterEach(() => {
    if (dom) dom.window.close();
    dom = undefined;
  });

  test('TODOリストが正しくレンダリングされる', async () => {
    // Arrange（準備）：サーバーから2件のTODOが返ってくる状況を用意する
    const fetchMock = createFetchMock([
      { id: 1, title: '牛乳を買う', completed: false },
      { id: 2, title: 'レポートを書く', completed: true },
    ]);

    // Act（実行）：ページを読み込み、初期描画を行わせる
    dom = await loadPage(fetchMock);

    // Assert（検証）：一覧に2件が表示され、完了状態が反映されていること
    const items = dom.window.document.querySelectorAll('#todo-list li');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('span').textContent).toBe('牛乳を買う');
    expect(items[0].classList.contains('completed')).toBe(false);
    expect(items[1].querySelector('span').textContent).toBe('レポートを書く');
    expect(items[1].classList.contains('completed')).toBe(true);
    expect(items[1].querySelector('input[type=checkbox]').checked).toBe(true);
  });

  test('追加フォームの送信でfetch POSTが呼ばれる', async () => {
    // Arrange（準備）：TODOが0件の状態でページを読み込む
    const fetchMock = createFetchMock([]);
    dom = await loadPage(fetchMock);
    const { document } = dom.window;

    // Act（実行）：タイトルを入力してフォームを送信する
    document.getElementById('todo-title').value = '新しいタスク';
    document
      .getElementById('todo-form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert（検証）：POST /todos がタイトル・優先度（未選択時は初期値の1）付きで呼ばれていること
    expect(fetchMock).toHaveBeenCalledWith(
      '/todos',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: '新しいタスク', priority: 1 }),
      })
    );
  });

  test('完了チェックボックスのクリックでfetch PATCHが呼ばれる', async () => {
    // Arrange（準備）：未完了のTODOを1件用意してページを読み込む
    const fetchMock = createFetchMock([{ id: 5, title: '掃除する', completed: false }]);
    dom = await loadPage(fetchMock);
    const { document } = dom.window;

    // Act（実行）：チェックボックスをオンにして変更イベントを発火する
    const checkbox = document.querySelector('#todo-list li input[type=checkbox]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert（検証）：PATCH /todos/5 がcompleted:trueで呼ばれていること
    expect(fetchMock).toHaveBeenCalledWith(
      '/todos/5',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      })
    );
  });

  test('削除ボタンのクリックでfetch DELETEが呼ばれる', async () => {
    // Arrange（準備）：削除対象のTODOを1件用意してページを読み込む
    const fetchMock = createFetchMock([{ id: 7, title: '不要なタスク', completed: false }]);
    dom = await loadPage(fetchMock);
    const { document } = dom.window;

    // Act（実行）：削除ボタンをクリックする
    const deleteButton = document.querySelector('#todo-list li button');
    deleteButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert（検証）：DELETE /todos/7 が呼ばれていること
    expect(fetchMock).toHaveBeenCalledWith('/todos/7', expect.objectContaining({ method: 'DELETE' }));
  });
});
