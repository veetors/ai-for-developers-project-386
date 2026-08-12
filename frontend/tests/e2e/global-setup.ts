import { spawn } from 'node:child_process';
import path from 'node:path';

const PRISM_PORT = 4010;
const PRISM_HOST = '127.0.0.1';
const contractPath = path.resolve(process.cwd(), '../spec/generated/openapi.yaml');

let prismProcess: ReturnType<typeof spawn> | null = null;

async function waitFor(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) {
        return;
      }
      lastError = new Error(`Status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

export default async function globalSetup(): Promise<void> {
  const args = [
    'mock',
    contractPath,
    '--port',
    String(PRISM_PORT),
    '--host',
    PRISM_HOST,
    '--dynamic',
  ];
  prismProcess = spawn('npx', ['@stoplight/prism-cli', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  prismProcess.stdout?.on('data', (chunk) => {
    if (process.env.PWDEBUG) {
      process.stdout.write(`[prism] ${chunk.toString()}`);
    }
  });
  prismProcess.stderr?.on('data', (chunk) => {
    if (process.env.PWDEBUG) {
      process.stderr.write(`[prism stderr] ${chunk.toString()}`);
    }
  });

  await waitFor(`http://${PRISM_HOST}:${PRISM_PORT}/api/event-types`);

  const cleanup = () => {
    if (prismProcess && !prismProcess.killed) prismProcess.kill('SIGTERM');
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
