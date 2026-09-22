import { describe, expect, it } from 'vitest'
import { EMPTY_SETTINGS, parseSettingsInput, resolveSettings } from '../settings.js'

describe('parseSettingsInput', () => {
  it('accepts and normalizes a full payload', () => {
    const parsed = parseSettingsInput({
      spec: { baseUrl: 'https://relay.invalid/v1/', model: '  glm-4  ', sendResponseFormat: false },
      image: { baseUrl: 'http://127.0.0.1:8080/v1', model: 'flux' },
    })
    expect(parsed).toEqual({
      spec: { baseUrl: 'https://relay.invalid/v1', model: 'glm-4', sendResponseFormat: false },
      image: { baseUrl: 'http://127.0.0.1:8080/v1', model: 'flux' },
    })
  })

  it('drops empty strings so the value falls back to env or default', () => {
    expect(parseSettingsInput({ spec: { baseUrl: '', model: '   ' }, image: {} })).toEqual({
      spec: {},
      image: {},
    })
  })

  it('treats a missing body as empty rather than failing', () => {
    expect(parseSettingsInput(undefined)).toEqual(EMPTY_SETTINGS)
    expect(parseSettingsInput({})).toEqual(EMPTY_SETTINGS)
  })

  it('ignores unknown fields', () => {
    const parsed = parseSettingsInput({ spec: { model: 'x', apiKey: 'sk-leak' }, nope: 1 })
    expect(parsed).toEqual({ spec: { model: 'x' }, image: {} })
    expect(JSON.stringify(parsed)).not.toContain('sk-leak')
  })

  it('rejects a malformed baseUrl', () => {
    expect(() => parseSettingsInput({ spec: { baseUrl: 'not a url' } })).toThrow(/baseUrl/)
  })

  it('rejects a non-http protocol', () => {
    expect(() => parseSettingsInput({ image: { baseUrl: 'ftp://relay.invalid/v1' } })).toThrow(/http/)
  })

  it('rejects a non-boolean sendResponseFormat', () => {
    expect(() => parseSettingsInput({ spec: { sendResponseFormat: 'yes' } })).toThrow(
      /sendResponseFormat/,
    )
  })

  it('rejects a non-string model', () => {
    expect(() => parseSettingsInput({ spec: { model: 42 } })).toThrow(/model/)
  })
})

describe('resolveSettings', () => {
  const env = {
    VUDT_SPEC_MODEL: 'env-spec-model',
    VUDT_SPEC_BASE_URL: 'https://env.invalid/v1',
    VUDT_IMAGE_MODEL: 'env-image-model',
  } as unknown as NodeJS.ProcessEnv

  it('prefers the file over env, and env over defaults', () => {
    const { settings, sources } = resolveSettings({ spec: { model: 'file-model' }, image: {} }, env)

    expect(settings.spec.model).toBe('file-model')
    expect(sources.spec.model).toBe('file')
    expect(settings.spec.baseUrl).toBe('https://env.invalid/v1')
    expect(sources.spec.baseUrl).toBe('env')
    expect(settings.image.baseUrl).toBe('https://api.openai.com/v1')
    expect(sources.image.baseUrl).toBe('default')
    expect(settings.image.model).toBe('env-image-model')
    expect(sources.image.model).toBe('env')
  })

  it('pins the built-in default models', () => {
    const { settings, sources } = resolveSettings(EMPTY_SETTINGS, {} as NodeJS.ProcessEnv)
    expect(settings.spec.model).toBe('gpt-4o-mini')
    expect(sources.spec.model).toBe('default')
    expect(settings.image.model).toBe('gpt-image-1')
    expect(sources.image.model).toBe('default')
  })

  it('lets a file baseUrl win over an env baseUrl', () => {
    const { settings, sources } = resolveSettings(
      { spec: { baseUrl: 'https://file.invalid/v1' }, image: {} },
      { VUDT_SPEC_BASE_URL: 'https://env.invalid/v1' } as unknown as NodeJS.ProcessEnv,
    )
    expect(settings.spec.baseUrl).toBe('https://file.invalid/v1')
    expect(sources.spec.baseUrl).toBe('file')
  })

  it('defaults sendResponseFormat to true', () => {
    const { settings, sources } = resolveSettings(EMPTY_SETTINGS, {} as NodeJS.ProcessEnv)
    expect(settings.spec.sendResponseFormat).toBe(true)
    expect(sources.spec.sendResponseFormat).toBe('default')
  })

  it('reports a false sendResponseFormat as file-sourced', () => {
    const { settings, sources } = resolveSettings(
      { spec: { sendResponseFormat: false }, image: {} },
      {} as NodeJS.ProcessEnv,
    )
    expect(settings.spec.sendResponseFormat).toBe(false)
    expect(sources.spec.sendResponseFormat).toBe('file')
  })

  it('strips a trailing slash coming from env', () => {
    const { settings } = resolveSettings(EMPTY_SETTINGS, {
      VUDT_IMAGE_BASE_URL: 'https://env.invalid/v1/',
    } as unknown as NodeJS.ProcessEnv)
    expect(settings.image.baseUrl).toBe('https://env.invalid/v1')
  })
})
