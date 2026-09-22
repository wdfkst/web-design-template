import { ServerError } from './errors.js'

export interface ModelSettings {
  baseUrl?: string
  model?: string
}

export interface SpecSettings extends ModelSettings {
  /** Off when the relay rejects `response_format`; see the providers package. */
  sendResponseFormat?: boolean
}

export interface AppSettings {
  spec: SpecSettings
  image: ModelSettings
}

export type SettingSource = 'file' | 'env' | 'default'

export interface SettingsSources {
  spec: { baseUrl: SettingSource; model: SettingSource; sendResponseFormat: SettingSource }
  image: { baseUrl: SettingSource; model: SettingSource }
}

export interface EffectiveSettings {
  spec: { baseUrl: string; model: string; sendResponseFormat: boolean }
  image: { baseUrl: string; model: string }
}

export interface ResolvedSettings {
  settings: EffectiveSettings
  sources: SettingsSources
}

/**
 * Frozen through the nested objects: stores hand this baseline straight out of
 * `current()`, so one mutating consumer would otherwise corrupt it process-wide.
 * A shallow freeze would leave `spec`/`image` writable and fix nothing.
 */
export const EMPTY_SETTINGS: AppSettings = Object.freeze({
  spec: Object.freeze({}),
  image: Object.freeze({}),
}) as AppSettings

const DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  specModel: 'gpt-4o-mini',
  imageModel: 'gpt-image-1',
} as const

/** Trailing slashes are stripped here so `sources` shows what is actually sent. */
function normalizeBaseUrl(raw: string, field: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ServerError(`${field} must be a valid URL`, 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServerError(`${field} must use http or https`, 400)
  }
  return trimmed
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** An empty string means "clear it": the key is dropped and lookup falls through. */
function parseModel(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') throw new ServerError(`${field} must be a string`, 400)
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

function parseBaseUrl(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') throw new ServerError(`${field} must be a string`, 400)
  if (raw.trim() === '') return undefined
  return normalizeBaseUrl(raw, field)
}

export function parseSettingsInput(body: unknown): AppSettings {
  const root = asRecord(body)
  const specIn = asRecord(root.spec)
  const imageIn = asRecord(root.image)

  const spec: SpecSettings = {}
  const specBaseUrl = parseBaseUrl(specIn.baseUrl, 'spec.baseUrl')
  if (specBaseUrl !== undefined) spec.baseUrl = specBaseUrl
  const specModel = parseModel(specIn.model, 'spec.model')
  if (specModel !== undefined) spec.model = specModel
  if (specIn.sendResponseFormat !== undefined && specIn.sendResponseFormat !== null) {
    if (typeof specIn.sendResponseFormat !== 'boolean') {
      throw new ServerError('spec.sendResponseFormat must be a boolean', 400)
    }
    spec.sendResponseFormat = specIn.sendResponseFormat
  }

  const image: ModelSettings = {}
  const imageBaseUrl = parseBaseUrl(imageIn.baseUrl, 'image.baseUrl')
  if (imageBaseUrl !== undefined) image.baseUrl = imageBaseUrl
  const imageModel = parseModel(imageIn.model, 'image.model')
  if (imageModel !== undefined) image.model = imageModel

  return { spec, image }
}

function pick<T>(
  fromFile: T | undefined,
  fromEnv: T | undefined,
  fallback: T,
): { value: T; source: SettingSource } {
  if (fromFile !== undefined) return { value: fromFile, source: 'file' }
  if (fromEnv !== undefined) return { value: fromEnv, source: 'env' }
  return { value: fallback, source: 'default' }
}

/** Env values are normalized too: an address pasted into a shell keeps its slash. */
function envUrl(raw: string | undefined, field: string): string | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  return normalizeBaseUrl(raw, field)
}

function envText(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  return raw.trim()
}

export function resolveSettings(file: AppSettings, env: NodeJS.ProcessEnv): ResolvedSettings {
  const specBaseUrl = pick(
    file.spec.baseUrl,
    envUrl(env.VUDT_SPEC_BASE_URL, 'VUDT_SPEC_BASE_URL'),
    DEFAULTS.baseUrl,
  )
  const specModel = pick(file.spec.model, envText(env.VUDT_SPEC_MODEL), DEFAULTS.specModel)
  const sendResponseFormat = pick<boolean>(file.spec.sendResponseFormat, undefined, true)
  const imageBaseUrl = pick(
    file.image.baseUrl,
    envUrl(env.VUDT_IMAGE_BASE_URL, 'VUDT_IMAGE_BASE_URL'),
    DEFAULTS.baseUrl,
  )
  const imageModel = pick(file.image.model, envText(env.VUDT_IMAGE_MODEL), DEFAULTS.imageModel)

  // Freshly built on every call, and `EffectiveSettings` has only primitive
  // leaves — so callers may retain the returned object as an immutable snapshot
  // with no cloning. A task does exactly that, which is what keeps editing
  // settings from rewriting what an already-queued task is doing. Keep it that
  // way: returning anything shared with `file` would break that guarantee.
  return {
    settings: {
      spec: {
        baseUrl: specBaseUrl.value,
        model: specModel.value,
        sendResponseFormat: sendResponseFormat.value,
      },
      image: { baseUrl: imageBaseUrl.value, model: imageModel.value },
    },
    sources: {
      spec: {
        baseUrl: specBaseUrl.source,
        model: specModel.source,
        sendResponseFormat: sendResponseFormat.source,
      },
      image: { baseUrl: imageBaseUrl.source, model: imageModel.source },
    },
  }
}
