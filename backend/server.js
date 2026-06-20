const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init');

const petsRouter = require('./routes/pets');
const boardingRouter = require('./routes/boarding');
const groomingRouter = require('./routes/grooming');
const transactionsRouter = require('./routes/transactions');
const vaccineRouter = require('./routes/vaccine');

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
app.use('/api/vaccine', vaccineRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

const net = require('net');

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function killPort(port) {
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = result.split('\n').filter(line => line.includes('LISTENING'));
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== '0') {
          console.log(`⚠️  端口 ${port} 被进程 PID:${pid} 占用，正在释放...`);
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`✅ 已释放端口 ${port}`);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  } catch (err) {
    console.log(`ℹ️  端口释放失败，将尝试下一端口: ${err.message}`);
  }
}

async function startServer() {
  try {
    let port = parseInt(PORT);
    let portAvailable = await checkPort(port);
    if (!portAvailable) {
      console.log(`⚠️  端口 ${port} 被占用，尝试释放...`);
      await killPort(port);
      portAvailable = await checkPort(port);
      if (!portAvailable) {
        port = port + 1;
        console.log(`ℹ️  切换到端口 ${port}`);
      }
    }

    await initDatabase();
    app.listen(port, () => {
      console.log('========================================');
      console.log('  宠物寄养与美容店管理系统 - 后端服务');
      console.log('========================================');
      console.log(`🚀 服务地址: http://localhost:${port}`);
      console.log('');
      console.log('� 可用API:');
      console.log(`   GET  /api/health       - 健康检查`);
      console.log(`   GET  /api/pets         - 宠物档案列表`);
      console.log(`   GET  /api/boarding     - 寄养预约列表`);
      console.log(`   GET  /api/grooming     - 美容预约列表`);
      console.log(`   GET  /api/transactions - 交易记录列表`);
      console.log(`   GET  /api/vaccine/alerts - 疫苗到期提醒列表`);
      console.log('========================================');
    });
  } catch (err) {
    console.error('❌ 服务器启动失败:', err.message);
    process.exit(1);
  }
}

startServer();
