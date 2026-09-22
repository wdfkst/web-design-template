import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { contentTypeFor, openPreviewFile, resolveDistPath } from '../preview.js'

describe('resolveDistPath', () => {
  const dist = resolve('/tmp/task/dist')

  it('resolves normal paths inside dist', () => {
    expect(resolveDistPath(dist, 'assets/a1b2.png')).toBe(join(dist, 'assets', 'a1b2.png'))
  })

  it('treats an empty path as index.html', () => {
    expect(resolveDistPath(dist, '')).toBe(join(dist, 'index.html'))
  })

  it('rejects traversal, including encoded and backslash forms', () => {
    // The task dir holds a node_modules junction and sits under the platform's
    // workspace root, so escaping dist reaches real files.
    expect(resolveDistPath(dist, '../package.json')).toBeNull()
    expect(resolveDistPath(dist, 'assets/../../package.json')).toBeNull()
    expect(resolveDistPath(dist, '%2e%2e%2fpackage.json')).toBeNull()
    expect(resolveDistPath(dist, '..\\package.json')).toBeNull()
  })

  it('rejects a NUL byte and malformed percent-encoding', () => {
    expect(resolveDistPath(dist, 'index.html\0.png')).toBeNull()
    expect(resolveDistPath(dist, '%zz')).toBeNull()
  })

  it('does not let a sibling directory sharing the prefix through', () => {
    expect(resolveDistPath(dist, '../dist-evil/x.js')).toBeNull()
  })
})

describe('contentTypeFor', () => {
  it('maps the types a vite dist actually emits', () => {
    expect(contentTypeFor('index.html')).toBe('text/html; charset=utf-8')
    expect(contentTypeFor('assets/app.js')).toBe('text/javascript; charset=utf-8')
    expect(contentTypeFor('assets/app.css')).toBe('text/css; charset=utf-8')
    expect(contentTypeFor('assets/hero.png')).toBe('image/png')
  })

  it('falls back to octet-stream rather than guessing', () => {
    expect(contentTypeFor('weird.xyz')).toBe('application/octet-stream')
  })
})

describe('openPreviewFile', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vudt-preview-'))
    await mkdir(join(dir, 'assets'), { recursive: true })
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>x</title>')
    await writeFile(join(dir, 'assets', 'hero.png'), Buffer.from([137, 80, 78, 71]))
    await writeFile(join(dir, '..', 'outside.txt'), 'secret')
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
    await rm(join(dir, '..', 'outside.txt'), { force: true })
  })

  it('serves a file with its content type and size', async () => {
    const file = await openPreviewFile(dir, 'assets/hero.png')
    expect(file?.contentType).toBe('image/png')
    expect(file?.size).toBe(4)
  })

  it('serves index.html for the directory root', async () => {
    const file = await openPreviewFile(dir, '')
    expect(file?.path.endsWith(`${sep}index.html`)).toBe(true)
  })

  it('returns null for a traversal attempt even when the target exists', async () => {
    expect(await openPreviewFile(dir, '../outside.txt')).toBeNull()
  })

  it('returns null for a missing file', async () => {
    expect(await openPreviewFile(dir, 'assets/nope.png')).toBeNull()
  })
})
