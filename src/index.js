require('dotenv').config();
const express = require('express');
const path = require('path');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 3000;

// JSONリクエストボディをパースする
app.use(express.json());

// public/ フォルダを静的ファイルとして配信する
app.use(express.static(path.join(__dirname, '..', 'public')));

// TODO用のAPIルートを登録
app.use('/todos', todosRouter);

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
