import { exec } from 'node:child_process'
import { setTimeout as wait } from 'node:timers/promises'
import path from 'node:path'

const FRONTEND_URL = 'http://localhost:3000'
const BACKEND_HEALTH_URL = 'http://localhost:3000/api/event-types'
const COMPOSE_TEARDOWN = 'docker compose --profile default down -v'
const COMPOSE_UP = 'docker compose --profile default up -d --build --wait backend frontend db'

function execAsync(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} failed: ${err.message}\nstdout=${stdout}\nstderr=${stderr}`))
        return
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() })
    })
  })
}

async function waitForHttp(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) {
        return
      }
      lastError = new Error(`Status ${res.status}`)
    } catch (err) {
      lastError = err
    }
    await wait(500)
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`)
}

export default async function globalSetup(): Promise<void> {
  const repoRoot = path.resolve(process.cwd(), '..')

  if (process.env.PWDEBUG) {
    process.stdout.write(
      `[acceptance-setup] repoRoot=${repoRoot}\n[acceptance-setup] ${COMPOSE_TEARDOWN}\n`,
    )
  }

  await execAsync(COMPOSE_TEARDOWN, repoRoot)

  if (process.env.PWDEBUG) {
    process.stdout.write(`[acceptance-setup] ${COMPOSE_UP}\n`)
  }

  await execAsync(COMPOSE_UP, repoRoot)
  await waitForHttp(BACKEND_HEALTH_URL)
  await waitForHttp(FRONTEND_URL)

  const cleanup = async () => {
    if (process.env.PWDEBUG) {
      process.stdout.write(`[acceptance-setup] teardown: ${COMPOSE_TEARDOWN}\n`)
    }
    try {
      await execAsync(COMPOSE_TEARDOWN, repoRoot)
    } catch {
      // best-effort teardown
    }
  }

  process.on('SIGINT', () => {
    void cleanup()
  })
  process.on('SIGTERM', () => {
    void cleanup()
  })
}
