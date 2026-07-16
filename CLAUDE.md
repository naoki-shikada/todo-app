# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際にClaude Codeが従うべきルールをまとめたものです。

## プロジェクト概要

Node.js + Express で構築したシンプルなTODOアプリ。バックエンドAPIとHTML/CSS/JSのフロントエンドで構成される。

## ディレクトリ構成

- バックエンド: `src/` 配下
  - `src/index.js` — Expressサーバーのエントリーポイント
  - `src/routes/todos.js` — TODOのCRUD APIルート
  - `src/db/pool.js` — データベース接続プール
- フロントエンド: `public/` 配下
  - `public/index.html` — 操作画面（HTML/CSS/JS）
  - バックエンドとの通信はfetch APIを使用する

## コーディング規約

- エラーハンドリングは必ず実装する（try/catchやエラーレスポンスの省略は不可）
- コメントは日本語で書く

## テスト

- テストフレームワークはJestを使用する
- フロントエンドのテストはjsdom環境で実行する
