import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BuildError } from '../errors.js'
import { WorkspaceRoot, within } from '../workspace.js'

const dirs: string[] = []

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vudt-ws-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('WorkspaceRoot', () => {
  it('allocates a directory under the root', async () => {
    const root = new WorkspaceRoot(await tempRoot())
    const ws = await root.allocate('task-1')
    expect(ws.dir.startsWith(root.path)).toBe(true)
    expect((await stat(ws.dir)).isDirectory()).toBe(true)
  })

  it('wipes a stale directory so the previous run cannot be mistaken for this one', async () => {
    const root = new WorkspaceRoot(await tempRoot())
    const first = await root.allocate('task-1')
    await writeFile(join(first.dir, 'stale.txt'), 'old')
    const second = await root.allocate('task-1')
    await expect(stat(join(second.dir, 'stale.txt'))).rejects.toThrow()
  })

  it('rejects a task id that would escape the root', async () => {
    const root = new WorkspaceRoot(await tempRoot())
    for (const bad of ['..', '../evil', 'a/b', 'C:\evil', 'UPPER', '']) {
      await expect(root.allocate(bad)).rejects.toThrow(BuildError)
    }
  })

  it('dispose removes the directory', async () => {
    const root = new WorkspaceRoot(await tempRoot())
    const ws = await root.allocate('task-1')
    await ws.dispose()
    await expect(stat(ws.dir)).rejects.toThrow()
  })
})

describe('within', () => {
  it('resolves a child path', () => {
    expect(within('/base', 'a/b.txt').endsWith(join('a', 'b.txt'))).toBe(true)
  })

  it('refuses traversal, absolute paths, and the base itself', () => {
    for (const bad of ['../out', 'a/../../out', '/etc/passwd', '.']) {
      expect(() => within('/base', bad)).toThrow(BuildError)
    }
  })
})
