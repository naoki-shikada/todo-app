-- todosテーブルにpriorityカラムを追加する
ALTER TABLE todos ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
