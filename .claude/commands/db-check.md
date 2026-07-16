---
allowed-tools: Bash(psql:*), Bash(node:*), Read
description: PostgreSQL の接続確認と todos テーブルの状態チェックを行う
---

## .env の設定確認
!`grep -E "^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=" .env 2>&1 || echo ".env が見つからないか、必要な変数が不足しています"`

## DB接続・todosテーブル確認
!`node scripts/check-db.js 2>&1`

## .gitignore の確認
!`grep -Fx ".env" .gitignore 2>&1 || echo ".env が .gitignore に含まれていません"`

上記の結果をもとに、以下を確認してください：
1. .env に DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD がすべて設定されているか
2. DB接続確認でエラーが出ていないか、todos テーブルのレコード数が返っているか
3. .gitignore に .env が含まれているか

問題があれば修正方法を提示してください。
