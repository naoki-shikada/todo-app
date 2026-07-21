-- todosテーブルを作成する
CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY, -- 自動採番かつ重複しない値で、1件ずつを区別する
  title TEXT NOT NULL, -- 空文字(NULL)での保存を許さない
  completed BOOLEAN NOT NULL DEFAULT false, -- 未指定時はfalse(未完了)を自動で入れ、エラーを防ぐ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 作成された日時。以降変更されない
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- 更新されるたびにPATCHで書き換えられる日時
);
