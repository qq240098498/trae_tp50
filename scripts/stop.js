const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pidFile = path.resolve(__dirname, '..', '.process-pids.json');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function killProcess(pid, name = '') {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`✅ 已终止 ${name} 进程 (PID: ${pid})`);
  } catch (e) {
    console.log(`⚠️  终止 ${name} 进程失败: ${e.message}`);
  }
}

function killPort(port, name = '') {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = result.split('\n').filter(line => line.includes('LISTENING'));
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== '0') {
          killProcess(parseInt(pid), name + `(端口${port})`);
        }
      }
    }
  } catch (e) {}
}

async function main() {
  console.log('🛑 正在停止所有服务...\n');

  if (fs.existsSync(pidFile)) {
    try {
      const pids = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
      for (const [name, pid] of Object.entries(pids)) {
        killProcess(pid, name);
      }
      fs.unlinkSync(pidFile);
    } catch (e) {
      console.log('读取进程ID文件失败，尝试按端口清理...');
    }
  }

  await sleep(500);
  killPort(3000, '前端服务');
  killPort(3001, '后端服务');

  console.log('\n✅ 所有服务已停止');
}

main();
