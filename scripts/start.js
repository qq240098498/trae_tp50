const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const pidFile = path.join(rootDir, '.process-pids.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function savePids(pids) {
  fs.writeFileSync(pidFile, JSON.stringify(pids, null, 2));
}

function loadPids() {
  try {
    if (fs.existsSync(pidFile)) {
      return JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function clearPids() {
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

async function killProcess(pid, name = '') {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      exec(`taskkill /F /T /PID ${pid}`);
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`✅ 已终止 ${name} 进程 (PID: ${pid})`);
    await sleep(300);
  } catch (e) {
    console.log(`⚠️  终止 ${name} 进程失败: ${e.message}`);
  }
}

async function killAllExisting() {
  const pids = loadPids();
  if (Object.keys(pids).length > 0) {
    console.log('🔍 检测到上次运行的残留进程，正在清理...');
    for (const [name, pid] of Object.entries(pids)) {
      await killProcess(pid, name);
    }
    clearPids();
    console.log('');
  }
}

function printBanner() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║                                                ║');
  console.log('║    🐾 宠物寄养与美容店管理系统 🐾             ║');
  console.log('║                                                ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
}

function startService(name, cmd, args, cwd, prefix) {
  return new Promise((resolve) => {
    console.log(`▶️  正在启动 ${name}...`);
    
    let command;
    let argumentsList;
    if (process.platform === 'win32') {
      command = 'cmd.exe';
      argumentsList = ['/c', cmd, ...args];
    } else {
      command = cmd;
      argumentsList = args;
    }
    const child = spawn(command, argumentsList, {
      cwd,
      env: { ...process.env, FORCE_COLOR: 'true' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const prefixStr = `[${prefix}]`;
    
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`${prefixStr} ${line}`);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`${prefixStr} ${line}`);
        }
      });
    });

    child.on('error', (err) => {
      console.error(`❌ ${name} 启动错误: ${err.message}`);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(`⚠️  ${name} 退出，代码: ${code}`);
      }
    });

    resolve(child);
  });
}

async function waitForService(url, timeout = 30000, interval = 1000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch (e) {}
    await sleep(interval);
  }
  return false;
}

async function main() {
  printBanner();

  await killAllExisting();

  function runNpmInstall(dir) {
    return new Promise(resolve => {
      let cmd, args;
      if (process.platform === 'win32') {
        cmd = 'cmd.exe';
        args = ['/c', 'npm', 'install'];
      } else {
        cmd = 'npm';
        args = ['install'];
      }
      const proc = spawn(cmd, args, { cwd: dir, stdio: 'inherit' });
      proc.on('exit', resolve);
    });
  }

  if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
    console.log('📦 检测到后端依赖未安装，正在安装...');
    await runNpmInstall(backendDir);
  }

  if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
    console.log('📦 检测到前端依赖未安装，正在安装...');
    await runNpmInstall(frontendDir);
  }

  const pids = {};

  const backend = await startService(
    '后端服务',
    'npm',
    ['start'],
    backendDir,
    '后端'
  );
  pids.backend = backend.pid;
  savePids(pids);

  console.log('⏳ 等待后端服务就绪...');
  const backendReady = await waitForService('http://localhost:3001/api/health');
  if (backendReady) {
    console.log('✅ 后端服务已就绪\n');
  } else {
    console.log('⚠️  后端服务启动较慢，继续启动前端...\n');
  }

  const frontend = await startService(
    '前端服务',
    'npm',
    ['run', 'dev'],
    frontendDir,
    '前端'
  );
  pids.frontend = frontend.pid;
  savePids(pids);

  console.log('⏳ 等待前端服务就绪...');
  const frontendReady = await waitForService('http://localhost:3000', 20000);
  if (frontendReady) {
    console.log('✅ 前端服务已就绪\n');
  }

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🎉 所有服务已启动完成！                       ║');
  console.log('║                                                ║');
  console.log('║  🌐 前端地址:  http://localhost:3000           ║');
  console.log('║  🔌 后端API:   http://localhost:3001           ║');
  console.log('║                                                ║');
  console.log('║  按 Ctrl+C 可停止所有服务                       ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  process.on('SIGINT', async () => {
    console.log('\n\n🛑 正在停止所有服务...');
    for (const [name, pid] of Object.entries(pids)) {
      await killProcess(pid, name);
    }
    clearPids();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 正在停止所有服务...');
    for (const [name, pid] of Object.entries(pids)) {
      await killProcess(pid, name);
    }
    clearPids();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  clearPids();
  process.exit(1);
});
