const { initDatabase } = require('./init');

initDatabase().then(() => {
  console.log('数据库初始化成功');
  process.exit(0);
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
