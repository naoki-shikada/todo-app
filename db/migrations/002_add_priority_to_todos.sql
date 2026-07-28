-- todosテーブルにpriorityカラムを追加する（有効な値は1・2・3のみ。未指定時・既存行は1(低)を初期値にする）
ALTER TABLE todos ADD COLUMN priority INTEGER NOT NULL DEFAULT 1;
