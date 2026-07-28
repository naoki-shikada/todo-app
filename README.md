# TODOアプリ

Node.js + Express のバックエンドと、素のHTML/CSS/JavaScriptのフロントエンドで構成されたシンプルなTODOアプリです。データはPostgreSQLに永続化されます。

## ファイル構成

```text
todo-app/
├── docker-compose.yml     # ローカル開発用PostgreSQLコンテナ
├── package.json
├── README.md
├── db/
│   └── migrations/        # テーブル作成用SQL
├── scripts/
│   └── migrate.js         # マイグレーション実行スクリプト
├── src/
│   ├── index.js          # Expressサーバーのエントリーポイント
│   ├── db/
│   │   └── pool.js        # PostgreSQL接続プール
│   └── routes/
│       └── todos.js      # TODOのCRUD APIルート
└── public/
    └── index.html         # 操作画面（HTML/CSS/JS）
```

## セットアップ

```bash
npm install
cp .env.example .env   # 未作成の場合。既定値のままローカル開発で利用可能
docker compose up -d   # PostgreSQLコンテナを起動
npm run db:migrate     # todosテーブルを作成
```

## 起動

```bash
npm start
```

起動後、ブラウザで <http://localhost:3000> を開いてください。

## API仕様

| メソッド | パス | 説明 | リクエストボディ例 |
| --- | --- | --- | --- |
| GET | /todos | TODO一覧を取得（`?completed=true\|false`・`?search=キーワード`・`?priority=1\|2\|3`で絞り込み可、組み合わせ可） | - |
| POST | /todos | TODOを新規作成 | `{ "title": "牛乳を買う", "priority": 2 }` |
| PATCH | /todos/:id | TODOを更新（完了切替・優先度変更など） | `{ "completed": true }` |
| DELETE | /todos/:id | TODOを削除 | - |

- `title` は必須・空文字不可（前後の空白はtrim）・255文字以内
- `completed` はboolean型のみ許可
- `priority` は`1`（低）・`2`（中）・`3`（高）の整数のみ許可。省略時は`1`がデフォルトで設定される
- `search` はtitleに対する部分一致（大文字小文字を区別しないあいまい検索）。空文字は絞り込みなし扱い
- `:id` は数値形式のみ許可（数値以外は404）
- 存在しないidへのPATCH/DELETEは404を返す

TODOデータは環境変数`DB_*`で指定したPostgreSQLに永続化されます（`.env`参照）。
