const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init');

const petsRouter = require('./routes/pets');
const boardingRouter = require('./routes/boarding');
const groomingRouter = require('./routes/grooming');
const transactionsRouter = require('./routes/transactions');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '宠物寄养与美容店管理系统API运行正常' });
});

app.use('/api/pets', petsRouter);
app.use('/api/boarding', boardingRouter);
app.use('/api/grooming', groomingRouter);
app.use('/api/transactions', transactionsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
      console.log(`📁 API文档:`);
      console.log(`   GET  /api/health - 健康检查`);
      console.log(`   GET  /api/pets - 宠物档案列表`);
      console.log(`   GET  /api/boarding - 寄养预约列表`);
      console.log(`   GET  /api/grooming - 美容预约列表`);
      console.log(`   GET  /api/transactions - 交易记录列表`);
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
}

startServer();
