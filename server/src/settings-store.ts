import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  EMPTY_SETTINGS,
  parseSettingsInput,
  resolveSettings,
  type AppSettings,
  type ResolvedSettings,
} from './settings.js'

/**
 * The settings file is hand-editable, so neither bad JSON nor bad values may
 * stop the server: both degrade to "no file", which is a working configuration.
 */
export class SettingsStore {
  private readonly file: string
  private readonly env: NodeJS.ProcessEnv
  private settings: AppSettings = EMPTY_SETTINGS

  constructor(file: string, env: NodeJS.ProcessEnv = process.env) {
    this.file = file
    this.env = env
  }

  async load(): Promise<void> {
    let raw: string
    try {
      raw = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.settings = EMPTY_SETTINGS
        return
      }
      throw error
    }

    try {
      this.settings = parseSettingsInput(JSON.parse(raw))
    } catch {
      this.settings = EMPTY_SETTINGS
    }
  }

  current(): AppSettings {
    return this.settings
  }

  resolved(): ResolvedSettings {
    return resolveSettings(this.settings, this.env)
  }

  async save(next: AppSettings): Promise<ResolvedSettings> {
    await mkdir(dirname(this.file), { recursive: true })
    // Write-then-rename, same reason as the image cache: a reader must never
    // observe a half-written file.
    const staging = `${this.file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(staging, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    await rename(staging, this.file)
    this.settings = next
    return this.resolved()
  }
}

/** Test double: same contract, no disk. */
export class MemorySettingsStore {
  private settings: AppSettings
  private readonly env: NodeJS.ProcessEnv

  constructor(initial: AppSettings = EMPTY_SETTINGS, env: NodeJS.ProcessEnv = {}) {
    this.settings = initial
    this.env = env
  }

  async load(): Promise<void> {}

  current(): AppSettings {
    return this.settings
  }

  resolved(): ResolvedSettings {
    return resolveSettings(this.settings, this.env)
  }

  async save(next: AppSettings): Promise<ResolvedSettings> {
    this.settings = next
    return this.resolved()
  }
}
