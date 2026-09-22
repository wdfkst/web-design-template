import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BuildError } from '../errors.js'
import { runNodeSandboxed } from '../sandbox.js'

const dirs: string[] = []

async function scriptDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vudt-sandbox-'))
  dirs.push(dir)
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), body, 'utf8')
  }
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('runNodeSandboxed', () => {
  it('returns stdout and a zero exit code', async () => {
    const dir = await scriptDir({ 'ok.mjs': 'console.log("hello")' })
    const result = await runNodeSandboxed(join(dir, 'ok.mjs'), [], { cwd: dir })
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
  })

  it('reports a non-zero exit without throwing', async () => {
    const dir = await scriptDir({ 'fail.mjs': 'process.exit(3)' })
    const result = await runNodeSandboxed(join(dir, 'fail.mjs'), [], { cwd: dir })
    expect(result.code).toBe(3)
  })

  it('hides platform credentials from the child', async () => {
    const dir = await scriptDir({
      'env.mjs': 'console.log(JSON.stringify(process.env))',
    })
    process.env.VUDT_TEST_SECRET = 'sk-should-not-leak'
    try {
      const result = await runNodeSandboxed(join(dir, 'env.mjs'), [], { cwd: dir })
      const childEnv = JSON.parse(result.stdout) as Record<string, string>
      expect(childEnv.VUDT_TEST_SECRET).toBeUndefined()
      expect(result.stdout).not.toContain('sk-should-not-leak')
    } finally {
      delete process.env.VUDT_TEST_SECRET
    }
  })

  it('kills a script that exceeds the time limit', async () => {
    const dir = await scriptDir({ 'hang.mjs': 'setInterval(() => {}, 1000)' })
    await expect(
      runNodeSandboxed(join(dir, 'hang.mjs'), [], { cwd: dir, timeoutMs: 700 }),
    ).rejects.toThrow(/timed out/)
  }, 20_000)

  it('kills a script that floods stdout', async () => {
    const dir = await scriptDir({
      'flood.mjs': 'const line = "x".repeat(1024); setInterval(() => { for (let i = 0; i < 64; i++) console.log(line) }, 1)',
    })
    await expect(
      runNodeSandboxed(join(dir, 'flood.mjs'), [], {
        cwd: dir,
        maxOutputBytes: 32 * 1024,
        timeoutMs: 15_000,
      }),
    ).rejects.toThrow(/output limit/)
  }, 30_000)

  it('wraps a kill in a BuildError carrying the tail of the log', async () => {
    const dir = await scriptDir({
      'noisy-hang.mjs': 'console.log("before the hang"); setInterval(() => {}, 1000)',
    })
    const error = await runNodeSandboxed(join(dir, 'noisy-hang.mjs'), [], {
      cwd: dir,
      timeoutMs: 700,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BuildError)
    expect((error as BuildError).detail?.stdout).toContain('before the hang')
  }, 20_000)

  it('runs the script in the requested cwd', async () => {
    const dir = await scriptDir({ 'cwd.mjs': 'console.log(process.cwd())' })
    const result = await runNodeSandboxed(join(dir, 'cwd.mjs'), [], { cwd: dir })
    expect(result.stdout.trim().toLowerCase()).toContain('vudt-sandbox-')
  })

  it('passes arguments through without a shell', async () => {
    const dir = await scriptDir({ 'args.mjs': 'console.log(process.argv.slice(2).join("|"))' })
    // A shell would expand these; no shell means they arrive verbatim.
    const result = await runNodeSandboxed(join(dir, 'args.mjs'), ['a b', '$HOME', '&& echo hi'], {
      cwd: dir,
    })
    expect(result.stdout.trim()).toBe('a b|$HOME|&& echo hi')
  })
})
