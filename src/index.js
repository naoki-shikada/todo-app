require('dotenv').config();
const express = require('express');
const path = require('path');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 全リクエストが必ず通る（bodyがあれば解析するだけで、担当の判別はしない）
app.use(express.json());

// 2. publicフォルダ内のファイルが担当かどうかを自分で判別し、該当すれば配信する
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. /todos宛てかどうかを自分で判別し、該当すればtodos.jsの処理を実行する
app.use('/todos', todosRouter);

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
