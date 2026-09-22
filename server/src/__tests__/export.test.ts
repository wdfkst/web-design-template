import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDistArchive, createSourceArchive, resolveTaskDir } from '../export.js'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function fixtureTaskDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vudt-export-'))
  dirs.push(root)
  const taskDir = join(root, 'task-1')
  await mkdir(join(taskDir, 'src'), { recursive: true })
  await mkdir(join(taskDir, 'dist'), { recursive: true })
  await mkdir(join(taskDir, 'node_modules', 'vue'), { recursive: true })
  await writeFile(join(taskDir, 'package.json'), '{}')
  await writeFile(join(taskDir, 'src', 'main.ts'), 'export {}')
  await writeFile(join(taskDir, 'dist', 'index.html'), '<html></html>')
  await writeFile(join(taskDir, 'node_modules', 'vue', 'index.js'), 'module.exports={}')
  return taskDir
}

/** Drains an archiver stream and returns the entry paths it emitted. */
async function entriesOf(archive: import('archiver').Archiver): Promise<string[]> {
  const names: string[] = []
  archive.on('entry', (entry) => names.push(entry.name.replace(/\\/g, '/')))
  const sink: Buffer[] = []
  archive.on('data', (chunk: Buffer) => sink.push(chunk))
  await new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve())
    archive.on('error', reject)
    void archive.finalize()
  })
  return names.sort()
}

describe('resolveTaskDir', () => {
  it('joins a valid lowercase slug id', () => {
    expect(resolveTaskDir('/root', 'a3f9-12bc')).toBe(join('/root', 'a3f9-12bc'))
  })

  it('refuses a traversal attempt', () => {
    expect(() => resolveTaskDir('/root', '../etc')).toThrow(/invalid task id/)
  })

  it('refuses uppercase and path separators', () => {
    expect(() => resolveTaskDir('/root', 'ABC')).toThrow(/invalid task id/)
    expect(() => resolveTaskDir('/root', 'a/b')).toThrow(/invalid task id/)
  })
})

describe('createSourceArchive', () => {
  it('excludes node_modules and dist', async () => {
    const taskDir = await fixtureTaskDir()
    const names = await entriesOf(createSourceArchive(taskDir))

    expect(names).toContain('package.json')
    expect(names).toContain('src/main.ts')
    expect(names.some((name) => name.startsWith('node_modules'))).toBe(false)
    expect(names.some((name) => name.startsWith('dist'))).toBe(false)
  })
})

describe('createDistArchive', () => {
  it('packs only the dist contents at the archive root', async () => {
    const taskDir = await fixtureTaskDir()
    const names = await entriesOf(createDistArchive(taskDir))

    expect(names).toEqual(['index.html'])
  })
})
