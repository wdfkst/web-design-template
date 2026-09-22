import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { ImagegenError } from './errors.js'

/**
 * Content-addressed image store. The key is `Asset.contentHash`, which already
 * folds in the style bible, so a cache hit provably matches the prompt that
 * would have been sent. That is the only reason skipping the model call is safe.
 */
export interface ImageCache {
  get(contentHash: string): Promise<Uint8Array | null>
  set(contentHash: string, png: Uint8Array): Promise<void>
}

const HASH_PATTERN = /^[0-9a-f]{16}$/

function cacheFileName(contentHash: string): string {
  if (!HASH_PATTERN.test(contentHash)) {
    // The hash becomes a path segment, so anything but hex is a traversal risk.
    throw new ImagegenError(`invalid content hash for cache key: ${JSON.stringify(contentHash)}`)
  }
  return `${contentHash}.png`
}

/** Filesystem cache shared across tasks — hits are what keep re-runs cheap. */
export class FileImageCache implements ImageCache {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  private pathFor(contentHash: string): string {
    const file = join(this.root, cacheFileName(contentHash))
    if (file !== this.root && !file.startsWith(this.root + sep)) {
      throw new ImagegenError(`cache path escapes root: ${file}`)
    }
    return file
  }

  async get(contentHash: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathFor(contentHash)))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async set(contentHash: string, png: Uint8Array): Promise<void> {
    const file = this.pathFor(contentHash)
    await mkdir(dirname(file), { recursive: true })
    // Write-then-rename: two tasks generating the same asset concurrently must
    // never let a reader observe a half-written PNG.
    const staging = `${file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(staging, png)
    await rename(staging, file)
  }
}

/** In-memory cache for tests and single-shot runs. */
export class MemoryImageCache implements ImageCache {
  private readonly entries = new Map<string, Uint8Array>()

  async get(contentHash: string): Promise<Uint8Array | null> {
    return this.entries.get(cacheFileName(contentHash)) ?? null
  }

  async set(contentHash: string, png: Uint8Array): Promise<void> {
    this.entries.set(cacheFileName(contentHash), png)
  }
}

/** Cache that never hits — forces regeneration without changing call sites. */
export const NO_CACHE: ImageCache = {
  async get() {
    return null
  },
  async set() {},
}
