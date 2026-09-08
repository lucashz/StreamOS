import { spawnSync } from 'node:child_process';

const api = process.env.API_URL ?? 'http://localhost:3001';

function docker(...args) {
  const result = spawnSync('docker', ['compose', ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `docker ${args.join(' ')}`);
}

async function readyStatus() {
  try {
    return (await fetch(`${api}/health/ready`)).status;
  } catch {
    return 0;
  }
}

async function eventually(check, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timeout aguardando recuperação do serviço');
}

async function outage(service) {
  docker('stop', service);
  await eventually(async () => (await readyStatus()) !== 200, 15_000);
  docker('up', '-d', '--wait', service);
  await eventually(async () => (await readyStatus()) === 200);
}

try {
  if ((await readyStatus()) !== 200) throw new Error('API não estava pronta');
  await outage('redis');
  await outage('postgres');
  console.log(
    JSON.stringify({
      result: 'ok',
      redisFailClosedAndRecovered: true,
      postgresReadinessAndRecovered: true,
    }),
  );
} finally {
  docker('up', '-d', '--wait', 'redis', 'postgres');
}
