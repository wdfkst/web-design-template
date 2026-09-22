import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileImageCache, MemoryImageCache, NO_CACHE } from '../cache.js'
import { ImagegenError } from '../errors.js'

const HASH = '0123456789abcdef'
const dirs: string[] = []

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vudt-cache-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('FileImageCache', () => {
  it('returns null on a miss and the bytes after a set', async () => {
    const cache = new FileImageCache(await tempRoot())
    expect(await cache.get(HASH)).toBeNull()
    await cache.set(HASH, new Uint8Array([1, 2, 3]))
    expect([...(await cache.get(HASH))!]).toEqual([1, 2, 3])
  })

  it('leaves no staging files behind', async () => {
    const root = await tempRoot()
    const cache = new FileImageCache(root)
    await cache.set(HASH, new Uint8Array([1]))
    expect(await readdir(root)).toEqual([`${HASH}.png`])
  })

  it('rejects a key that is not a 16-char hex hash', async () => {
    const cache = new FileImageCache(await tempRoot())
    for (const bad of ['../escape', 'not-hex-at-all!', 'abc', `${HASH}0`]) {
      await expect(cache.get(bad)).rejects.toThrow(ImagegenError)
    }
  })
})

describe('MemoryImageCache', () => {
  it('round-trips bytes', async () => {
    const cache = new MemoryImageCache()
    await cache.set(HASH, new Uint8Array([9]))
    expect([...(await cache.get(HASH))!]).toEqual([9])
  })
})

describe('NO_CACHE', () => {
  it('always misses', async () => {
    await NO_CACHE.set(HASH, new Uint8Array([1]))
    expect(await NO_CACHE.get(HASH)).toBeNull()
  })
})
