const { spawn, execSync } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || 'localhost';
const OPENAPI_URL = `http://${HOST}:${PORT}/openapi.json`;
const HEALTH_URL = `http://${HOST}:${PORT}/health`;
const STARTUP_TIMEOUT = 30000;
const POLL_INTERVAL = 500;

function pollUrl(url, timeout, interval) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function check() {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          scheduleNext();
        }
      }).on('error', () => {
        scheduleNext();
      });
    }

    function scheduleNext() {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, interval);
      }
    }

    check();
  });
}

async function main() {
  console.log('Starting server to generate OpenAPI spec...');

  const serverProcess = spawn('npx', ['tsx', 'src/server.ts'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT },
    detached: true
  });

  let serverOutput = '';
  serverProcess.stdout.on('data', (data) => { serverOutput += data.toString(); });
  serverProcess.stderr.on('data', (data) => { serverOutput += data.toString(); });

  try {
    console.log(`Waiting for server at ${HEALTH_URL}...`);
    await pollUrl(HEALTH_URL, STARTUP_TIMEOUT, POLL_INTERVAL);
    console.log('Server is ready, generating SDK...');

    execSync('npx orval', { stdio: 'inherit' });

    console.log('SDK generated successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Server output:', serverOutput);
    process.exitCode = 1;
  } finally {
    console.log('Stopping server...');
    try {
      process.kill(-serverProcess.pid, 'SIGTERM');
    } catch (e) {
      // ignore
    }
  }
}

main();