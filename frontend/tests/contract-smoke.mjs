// Smoke-проверка контракта: поднимает Prism и дергает GET /api/event-types.
// Используется как ручной sanity-check после изменения api.tsp.
// Запуск: `npm run mock:contract`.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const contractPath = '../spec/generated/openapi.yaml';
const port = 4011;

const child = spawn('npx', ['-y', '@stoplight/prism-cli', 'mock', contractPath, '--port', String(port), '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let exitCode = 0;

try {
  await wait(2_000);
  const res = await fetch(`http://127.0.0.1:${port}/api/event-types`);
  if (!res.ok) {
    console.error(`Prism returned ${res.status}`);
    exitCode = 1;
  } else {
    const body = await res.json();
    if (!Array.isArray(body)) {
      console.error('Expected array of EventType');
      exitCode = 1;
    } else {
      console.log(`OK: ${body.length} event type(s) sampled`);
    }
  }
} catch (err) {
  console.error('Contract smoke failed:', err);
  exitCode = 1;
} finally {
  child.kill('SIGTERM');
  process.exit(exitCode);
}
