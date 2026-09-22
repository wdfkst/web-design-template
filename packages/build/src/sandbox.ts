import { spawn } from 'node:child_process'
import { BuildError } from './errors.js'
import { sandboxEnv, type SandboxEnvOptions } from './env.js'

export interface SandboxRunOptions extends SandboxEnvOptions {
  cwd: string
  /** Wall-clock ceiling. On expiry the whole process tree is killed. */
  timeoutMs?: number
  /** V8 heap ceiling for node children, passed via --max-old-space-size. */
  maxOldSpaceMb?: number
  /** Bytes of stdout/stderr retained; beyond this the child is killed. */
  maxOutputBytes?: number
}

export interface SandboxResult {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  durationMs: number
}

const DEFAULTS = {
  timeoutMs: 180_000,
  maxOldSpaceMb: 2048,
  maxOutputBytes: 512 * 1024,
}

/**
 * Runs one node script with a scrubbed environment and hard ceilings.
 *
 * Deliberately node-only: the build steps we need are `vite`/`vue-tsc` JS entry
 * points, and resolving an arbitrary command string through a shell would hand
 * the generated project a much easier path to running whatever it likes. No
 * shell is involved anywhere here.
 */
export async function runNodeSandboxed(
  scriptPath: string,
  args: readonly string[],
  options: SandboxRunOptions,
): Promise<SandboxResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs
  const maxOldSpaceMb = options.maxOldSpaceMb ?? DEFAULTS.maxOldSpaceMb
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULTS.maxOutputBytes
  const started = Date.now()

  const env = sandboxEnv(process.env, {
    ...(options.network !== undefined ? { network: options.network } : {}),
    ...(options.extra !== undefined ? { extra: options.extra } : {}),
  })

  const child = spawn(
    process.execPath,
    [`--max-old-space-size=${maxOldSpaceMb}`, scriptPath, ...args],
    {
      cwd: options.cwd,
      env,
      shell: false,
      windowsHide: true,
      // Detached so the timeout can kill descendants too; vite spawns workers,
      // and killing only the direct child would leak them.
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let stdout = ''
  let stderr = ''
  let killReason: string | null = null

  const kill = (reason: string): void => {
    if (killReason !== null) return
    killReason = reason
    try {
      if (process.platform !== 'win32' && child.pid !== undefined) {
        process.kill(-child.pid, 'SIGKILL')
      } else {
        child.kill('SIGKILL')
      }
    } catch {
      child.kill('SIGKILL')
    }
  }

  const collect = (chunk: string, which: 'out' | 'err'): void => {
    if (which === 'out') stdout += chunk
    else stderr += chunk
    if (stdout.length + stderr.length > maxOutputBytes) kill('output limit exceeded')
  }

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (c: string) => collect(c, 'out'))
  child.stderr.on('data', (c: string) => collect(c, 'err'))

  const timer = setTimeout(() => kill(`timed out after ${timeoutMs}ms`), timeoutMs)

  try {
    const result = await new Promise<SandboxResult>((resolvePromise, rejectPromise) => {
      child.on('error', rejectPromise)
      child.on('close', (code, signal) => {
        resolvePromise({
          code,
          signal,
          stdout,
          stderr,
          durationMs: Date.now() - started,
        })
      })
    })

    if (killReason !== null) {
      throw new BuildError(`sandboxed build killed: ${killReason}`, {
        stdout: tail(stdout),
        stderr: tail(stderr),
        code: result.code,
        signal: result.signal,
      })
    }
    return result
  } finally {
    clearTimeout(timer)
  }
}

/** Keeps the useful end of a long log without carrying megabytes around. */
export function tail(text: string, limit = 4000): string {
  return text.length <= limit ? text : `…${text.slice(-limit)}`
}
