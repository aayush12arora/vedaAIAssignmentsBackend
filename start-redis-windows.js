const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const projectRoot = __dirname;
const localRedisPath = path.join(projectRoot, 'tools', 'redis', 'redis-server.exe');

function commandExists(command) {
  const check = spawnSync('where', [command], { shell: true, stdio: 'ignore' });
  return check.status === 0;
}

function run(command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false
  });

  const shutdown = () => {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function keepAlive(message) {
  console.log(message);

  const timer = setInterval(() => {}, 5000);

  const shutdown = () => {
    clearInterval(timer);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function pingRedis(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let data = '';

    const done = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1500);

    socket.on('connect', () => {
      socket.write('*1\r\n$4\r\nPING\r\n');
    });

    socket.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('PONG')) {
        done(true);
      }
    });

    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.on('close', () => {
      if (!data.includes('PONG')) {
        resolve(false);
      }
    });
  });
}

(async () => {
  const existingRedis = await pingRedis('127.0.0.1', 6379);

  if (existingRedis) {
    keepAlive('Using existing local Redis instance on 127.0.0.1:6379.');
    return;
  }

  if (fs.existsSync(localRedisPath)) {
    console.log('Using backend local Redis binary:', localRedisPath);
    run(localRedisPath, ['--bind', '127.0.0.1', '--port', '6379']);
    return;
  }

  if (commandExists('docker')) {
    console.log('Local Redis binary not found. Falling back to Docker redis:7 container.');
    run('docker', ['run', '--rm', '--name', 'vedaai-redis', '-p', '6379:6379', 'redis:7']);
    return;
  }

  console.error('Redis not found. Expected tools/redis/redis-server.exe or Docker Desktop.');
  process.exit(1);
})();
