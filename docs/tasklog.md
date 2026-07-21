# タスクログ

作業内容を時系列で記録するログです。

## 2026-07-15

### 02_プロジェクト作成
- ゴール：ブラウザで http://localhost:3000 にアクセスしてTODO画面が表示される
- 分解：① バックエンド骨格 → ② フロントエンド追加 → ③ README
- 検証：npm start → ブラウザで画面確認
- 失敗予測：
  - Node.js/npm が未インストールで `npm install` が実行できなかった → wingetで `OpenJS.NodeJS.LTS` をインストールして解消
  - インストール後も既存のPowerShellセッションにPATHが反映されず `node`/`npm` が見つからなかった → セッションを開き直す、または `$env:PATH` に手動追加が必要
  - PowerShellの実行ポリシーにより `npm start` が `npm.ps1` を読み込めずエラー → `npm.cmd start` と拡張子を明示することで回避
  - 誤ったディレクトリ（`my-claude-project`）で `npm start` を実行し `package.json` が見つからないエラー → `todo-app` ディレクトリに移動して解消

### 03_PostgreSQL・CRUD実装

- ゴール：curl でCRUDが動作する・ブラウザでTODOのDB永続化が確認できる
- 分解：① DB・テーブル作成 → ② .env作成 → ③ CRUD API実装 → ④ テスト追加
- 検証：curl で正常系・異常系を確認 / npm test グリーン
- 失敗予測：
  - psqlコマンドがPATHに通っておらず接続できない
  - DB接続の Peer authentication failed（pg_hba.confの設定不足）
  - .envの読み込み忘れ（dotenvのrequire/importを書き忘れる）
  - title が空文字・NULLでもINSERTが通ってしまう（バリデーション漏れ）
  - PATCHなのに実装がPUT相当（全項目上書き必須）になってしまう
- 失敗予測との比較（実施結果）：
  - .envの読み込み忘れ → `src/index.js`・`src/db/pool.js`双方で`require('dotenv').config()`を実装済み
  - titleが空文字・NULLでもINSERTが通ってしまう → `validateTitle`でtrim後の空文字を弾く実装。`__tests__/routes/todos.test.js`の「titleが空文字の場合は400が返る」等のテストで確認済み
  - PATCHがPUT相当になってしまう → 指定されたフィールドのみSET句に含める実装で、部分更新になっている

### 05_EC2デプロイ・CICD

- ゴール：http://<EC2のIP> でTODO画面が表示される・CICDが通る
- 分解：EC2起動 → セットアップ → 手動デプロイ確認 → GitHub Secrets → CI/CD設定
- 検証：ブラウザで画面表示 / GitHub Actions の green チェック
- 失敗予測：
  - SSH接続の権限エラー（.pemファイルの権限が400になっていない）
  - セキュリティグループでポート（80/443）を開け忘れる
  - DB接続の Peer authentication failed（pg_hba.confの設定不足）
  - .envをサーバー側に作り忘れる、またはGitに誤ってコミットしてしまう
  - SSH切断でアプリのプロセスが落ちる（pm2等でのプロセス管理を忘れている）
  - GitHub SecretsにEC2の接続情報（SSH鍵, IPなど）を登録し忘れてCI/CDが失敗する
  - Nginxの設定ミスでリバースプロキシが502エラーになる
- 失敗予測との比較（実施結果）：
  - 的中：DB接続の認証エラー → ただし内容は「Peer authentication failed」ではなく「password authentication failed」。原因はEC2に元から入っていた別のPostgreSQL（本番想定、`todo_db`/5432番）に接続してしまっていたこと
  - 的中（内容が変化）：`.env`関連のトラブル → 「作り忘れ」ではなく、開発用（Docker、`todo_app`/5433番）と本番想定（`todo_db`/5432番、`todo_password_prod`）の接続先が二重に存在し、値の食い違いで混乱した。加えてpm2は`.env`変更後に再起動しても`--update-env`を付けないと環境変数を読み直さないためハマった
  - SSH接続の権限エラー → 事前に`icacls`で鍵ファイルの権限を絞っていたため未発生
  - pm2等でのプロセス管理忘れ → 最初からpm2で起動されており問題なし
  - 予測外の失敗：
    - ローカルで鍵ファイルの場所を勘違いし（`Downloads`ではなく別フォルダで実行）SSHが「No such file or directory」に
    - `<YOUR_IP>`等のプレースホルダの山括弧をそのまま入力し、ホスト名解決エラーになった
    - GitHubは2021年以降パスワード認証を廃止していることを知らず、Personal Access Tokenを使わず何度も認証失敗した
    - クローン先リポジトリ名を`my-claude-project`だと思い込み「Repository not found」になった（正しくは`todo-app`）
    - ローカルに同種の重複フォルダが3つ存在（空の残骸`my-claude-project`／重複クローン`todo-app`／作業用`my-cloud-project`）しており整理が必要になった。削除時、フォルダを開いたままのウィンドウが残っていて「Device or resource busy」エラーになった
    - pm2のエラーログに直す前の古いエラーが残り続け、実際は直っているのに直っていないように見えて紛らわしかった
