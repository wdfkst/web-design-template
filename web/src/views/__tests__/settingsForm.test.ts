import { describe, expect, it } from 'vitest'
import {
  emptyForm,
  formFromEnvelope,
  payloadFromForm,
  probeFailure,
  saveFailure,
  sourceLabel,
} from '../settingsForm.js'
import { ApiError, type SettingsEnvelope } from '../../api/client.js'

function envelope(): SettingsEnvelope {
  return {
    settings: {
      spec: { baseUrl: 'https://relay.invalid/v1', model: 'glm-4', sendResponseFormat: false },
      image: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1' },
    },
    sources: {
      spec: { baseUrl: 'file', model: 'env', sendResponseFormat: 'file' },
      image: { baseUrl: 'default', model: 'default' },
    },
  }
}

describe('formFromEnvelope', () => {
  it('fills inputs only from file-sourced values, leaving inherited ones blank', () => {
    const form = formFromEnvelope(envelope())

    expect(form.spec.baseUrl).toBe('https://relay.invalid/v1')
    expect(form.spec.model).toBe('')
    expect(form.image.baseUrl).toBe('')
    expect(form.image.model).toBe('')
  })

  it('carries the effective values as placeholders', () => {
    const form = formFromEnvelope(envelope())

    expect(form.placeholders.spec.model).toBe('glm-4')
    expect(form.placeholders.image.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('keeps a false sendResponseFormat rather than defaulting it back to true', () => {
    expect(formFromEnvelope(envelope()).spec.sendResponseFormat).toBe(false)
  })
})

describe('payloadFromForm', () => {
  it('drops blank inputs so the value falls back to env or default', () => {
    const form = emptyForm()
    form.spec.model = '  glm-4  '
    form.image.baseUrl = '   '

    expect(payloadFromForm(form)).toEqual({
      spec: { model: 'glm-4', sendResponseFormat: true },
      image: {},
    })
  })

  it('always sends sendResponseFormat, because false must survive the round trip', () => {
    const form = emptyForm()
    form.spec.sendResponseFormat = false

    expect(payloadFromForm(form).spec.sendResponseFormat).toBe(false)
  })

  it('round-trips an envelope through the form unchanged', () => {
    const payload = payloadFromForm(formFromEnvelope(envelope()))

    expect(payload).toEqual({
      spec: { baseUrl: 'https://relay.invalid/v1', sendResponseFormat: false },
      image: {},
    })
  })
})

describe('sourceLabel', () => {
  it('names each source in the console language', () => {
    expect(sourceLabel('file')).toContain('配置')
    expect(sourceLabel('env')).toContain('环境变量')
    expect(sourceLabel('default')).toContain('默认')
  })
})

describe('saveFailure', () => {
  it('blames the form for a 400, which is bad user input', () => {
    const failure = saveFailure(new ApiError('spec.baseUrl must be a valid URL', 400))

    expect(failure.kind).toBe('input')
    expect(failure.refetch).toBe(false)
    expect(failure.message).toContain('spec.baseUrl must be a valid URL')
  })

  /**
   * The server persists the body BEFORE resolving env, so a 500 means saved-then-
   * misconfigured. Telling the user it was not saved would be a lie they act on.
   */
  it('never claims a 500 lost the save, and asks for a re-fetch', () => {
    const failure = saveFailure(new ApiError('server settings are misconfigured: x', 500))

    expect(failure.kind).toBe('server-config')
    expect(failure.refetch).toBe(true)
    expect(failure.message).not.toContain('未保存')
    expect(failure.message).toContain('已保存')
    expect(failure.message).toContain('环境变量')
  })

  it('treats a non-ApiError as an unknown failure without claiming anything about persistence', () => {
    const failure = saveFailure(new Error('network down'))

    expect(failure.kind).toBe('unknown')
    expect(failure.message).toContain('network down')
  })
})

describe('probeFailure', () => {
  it('reports a 501 as connectivity testing being unavailable, not as a crash', () => {
    const failure = probeFailure(new ApiError('connectivity testing is not configured', 501))

    expect(failure.kind).toBe('unsupported')
    expect(failure.message).toContain('未配置')
  })

  it('blames the form for a 400', () => {
    expect(probeFailure(new ApiError('image.model must be a string', 400)).kind).toBe('input')
  })

  it('blames the server env for a 500', () => {
    expect(probeFailure(new ApiError('server settings are misconfigured', 500)).kind).toBe(
      'server-config',
    )
  })
})
