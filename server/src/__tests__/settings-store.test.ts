import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsStore } from '../settings-store.js'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function tempFile(): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'vudt-settings-'))
  dirs.push(dir)
  return { dir, file: join(dir, 'settings.json') }
}

describe('SettingsStore', () => {
  it('treats a missing file as empty settings', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    expect(store.current()).toEqual({ spec: {}, image: {} })
    expect(store.resolved().settings.spec.model).toBe('gpt-4o-mini')
    expect(store.resolved().sources.spec.model).toBe('default')
  })

  it('saves, then reads back the same values from a fresh store', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    await store.save({ spec: { model: 'glm-4', sendResponseFormat: false }, image: {} })

    const reopened = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await reopened.load()
    expect(reopened.current()).toEqual({ spec: { model: 'glm-4', sendResponseFormat: false }, image: {} })
    expect(reopened.resolved().sources.spec.model).toBe('file')
  })

  it('leaves no temp file behind', async () => {
    const { dir, file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    await store.save({ spec: { model: 'glm-4' }, image: {} })

    const entries = await readdir(dir)
    expect(entries).toEqual(['settings.json'])
  })

  it('writes json a human can read', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    await store.save({ spec: { model: 'glm-4' }, image: {} })

    const raw = await readFile(file, 'utf8')
    // Pin the exact serialization: two-space indent and the trailing newline
    // save() appends deliberately, so a human diffing the file sees no churn.
    expect(raw).toBe(`${JSON.stringify({ spec: { model: 'glm-4' }, image: {} }, null, 2)}\n`)
    expect(JSON.parse(raw)).toEqual({ spec: { model: 'glm-4' }, image: {} })
  })

  it('ignores a corrupt file rather than refusing to start', async () => {
    const { file } = await tempFile()
    await writeFile(file, '{ not json', 'utf8')
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)

    await store.load()

    expect(store.current()).toEqual({ spec: {}, image: {} })
  })

  it('validates the file contents, dropping junk values', async () => {
    const { file } = await tempFile()
    await writeFile(file, JSON.stringify({ spec: { model: 42, apiKey: 'sk-leak' } }), 'utf8')
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)

    await store.load()

    expect(store.current()).toEqual({ spec: {}, image: {} })
  })

  it('re-throws errors that are not a missing file', async () => {
    // A directory is readable-but-not-a-file: not ENOENT, so it must be loud.
    // Inverting the ENOENT branch keeps every other test green, hence this one.
    const { dir } = await tempFile()
    const store = new SettingsStore(dir, {} as NodeJS.ProcessEnv)

    // Only that it rejects: the errno differs across platforms.
    await expect(store.load()).rejects.toThrow()
  })

  it('hands out settings a caller cannot mutate', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {} as NodeJS.ProcessEnv)
    await store.load()

    const settings = store.current()
    expect(() => {
      ;(settings.spec as { model?: string }).model = 'hijacked'
    }).toThrow()
    expect(store.current()).toEqual({ spec: {}, image: {} })
  })

  it('save returns the resolved view so the caller need not re-read', async () => {
    const { file } = await tempFile()
    const store = new SettingsStore(file, {
      VUDT_IMAGE_MODEL: 'env-image',
    } as unknown as NodeJS.ProcessEnv)
    await store.load()

    const resolved = await store.save({ spec: { model: 'glm-4' }, image: {} })

    expect(resolved.settings.spec.model).toBe('glm-4')
    expect(resolved.settings.image.model).toBe('env-image')
    expect(resolved.sources.image.model).toBe('env')
  })
})
