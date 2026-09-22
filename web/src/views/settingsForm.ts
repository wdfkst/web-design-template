import { ApiError, type SettingsEnvelope, type SettingsPayload, type SettingSource } from '../api/client.js'

export interface FormState {
  spec: { baseUrl: string; model: string; sendResponseFormat: boolean }
  image: { baseUrl: string; model: string }
  /** Effective values, shown as input placeholders when the field is inherited. */
  placeholders: {
    spec: { baseUrl: string; model: string }
    image: { baseUrl: string; model: string }
  }
  sources: SettingsEnvelope['sources']
}

const BLANK_SOURCES: SettingsEnvelope['sources'] = {
  spec: { baseUrl: 'default', model: 'default', sendResponseFormat: 'default' },
  image: { baseUrl: 'default', model: 'default' },
}

export function emptyForm(): FormState {
  return {
    spec: { baseUrl: '', model: '', sendResponseFormat: true },
    image: { baseUrl: '', model: '' },
    placeholders: { spec: { baseUrl: '', model: '' }, image: { baseUrl: '', model: '' } },
    sources: BLANK_SOURCES,
  }
}

/**
 * Only file-sourced values land in the inputs. An inherited value shown as text
 * would be saved back as an override on the next submit, silently pinning what
 * the environment was still free to change.
 */
function own(value: string, source: SettingSource): string {
  return source === 'file' ? value : ''
}

export function formFromEnvelope(envelope: SettingsEnvelope): FormState {
  const { settings, sources } = envelope
  return {
    spec: {
      baseUrl: own(settings.spec.baseUrl, sources.spec.baseUrl),
      model: own(settings.spec.model, sources.spec.model),
      sendResponseFormat: settings.spec.sendResponseFormat,
    },
    image: {
      baseUrl: own(settings.image.baseUrl, sources.image.baseUrl),
      model: own(settings.image.model, sources.image.model),
    },
    placeholders: {
      spec: { baseUrl: settings.spec.baseUrl, model: settings.spec.model },
      image: { baseUrl: settings.image.baseUrl, model: settings.image.model },
    },
    sources,
  }
}

/** A blank input means "clear it": the key is omitted so the server falls through. */
function text(raw: string): string | undefined {
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

export function payloadFromForm(form: FormState): SettingsPayload {
  const spec: SettingsPayload['spec'] = { sendResponseFormat: form.spec.sendResponseFormat }
  const specBaseUrl = text(form.spec.baseUrl)
  if (specBaseUrl !== undefined) spec.baseUrl = specBaseUrl
  const specModel = text(form.spec.model)
  if (specModel !== undefined) spec.model = specModel

  const image: SettingsPayload['image'] = {}
  const imageBaseUrl = text(form.image.baseUrl)
  if (imageBaseUrl !== undefined) image.baseUrl = imageBaseUrl
  const imageModel = text(form.image.model)
  if (imageModel !== undefined) image.model = imageModel

  return { spec, image }
}

export function sourceLabel(source: SettingSource): string {
  if (source === 'file') return '来自本页配置'
  if (source === 'env') return '继承自环境变量'
  return '默认值'
}

/**
 * Why these are pure functions and not inline in the .vue: the 400/500/501 split
 * carries the only load-bearing copy decisions on this page, and views are not
 * mounted in tests here. Kept testable on purpose.
 */
export type FailureKind = 'input' | 'server-config' | 'unsupported' | 'unknown'

export interface Failure {
  kind: FailureKind
  message: string
  /** True when the page must re-read the server's actual state before trusting the form. */
  refetch: boolean
}

function causeText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * A PUT 500 must never read as "not saved". The server writes the settings file
 * and only then resolves env vars, so a 500 means the body IS persisted and the
 * deployment's own VUDT_*_BASE_URL is broken. The page re-fetches so the user
 * sees the real current values instead of a guess.
 */
export function saveFailure(cause: unknown): Failure {
  if (cause instanceof ApiError) {
    if (cause.status === 400) {
      return { kind: 'input', message: `填写有误：${cause.message}`, refetch: false }
    }
    if (cause.status >= 500) {
      return {
        kind: 'server-config',
        message: `配置已保存，但服务端自身的环境变量有问题，暂时无法生效：${cause.message}。下面显示的是服务端当前的实际取值，请检查部署的 VUDT_*_BASE_URL。`,
        refetch: true,
      }
    }
  }
  return { kind: 'unknown', message: `保存请求未能完成：${causeText(cause)}`, refetch: true }
}

/** 501 is a normal deployment state: no API keys configured, so no probe exists. */
export function probeFailure(cause: unknown): Failure {
  if (cause instanceof ApiError) {
    if (cause.status === 501) {
      return {
        kind: 'unsupported',
        message: '该部署未配置 API key，连通性测试不可用。请先设置 VUDT_SPEC_API_KEY / VUDT_IMAGE_API_KEY。',
        refetch: false,
      }
    }
    if (cause.status === 400) {
      return { kind: 'input', message: `填写有误：${cause.message}`, refetch: false }
    }
    if (cause.status >= 500) {
      return {
        kind: 'server-config',
        message: `服务端自身的环境变量有问题：${cause.message}`,
        refetch: false,
      }
    }
  }
  return { kind: 'unknown', message: `测试请求未能完成：${causeText(cause)}`, refetch: false }
}
