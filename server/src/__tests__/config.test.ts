import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.js'

describe('loadConfig', () => {
  it('defaults to loopback and a repo-relative workspace', () => {
    const config = loadConfig({}, '/srv/app')
    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(4300)
    expect(config.workspaceRoot).toBe(resolve('/srv/app', '.vudt/tasks'))
    expect(config.templateDir).toBe(resolve('/srv/app', 'packages/templates/vue3-base'))
    expect(config.concurrency).toBe(1)
  })

  it('reads overrides from the environment', () => {
    const config = loadConfig(
      { VUDT_PORT: '8080', VUDT_CONCURRENCY: '3', VUDT_MAX_ASSETS: '8', VUDT_HOST: '0.0.0.0' },
      '/srv/app',
    )
    expect(config.port).toBe(8080)
    expect(config.concurrency).toBe(3)
    expect(config.maxAssets).toBe(8)
    expect(config.host).toBe('0.0.0.0')
  })

  it('refuses a non-numeric or non-positive value rather than falling back', () => {
    expect(() => loadConfig({ VUDT_PORT: 'abc' }, '/srv/app')).toThrow(/VUDT_PORT/)
    expect(() => loadConfig({ VUDT_MAX_ASSETS: '0' }, '/srv/app')).toThrow(/VUDT_MAX_ASSETS/)
  })

  it('does not carry model credentials on the config object', () => {
    // Credentials are read where the provider is built; a task record is what
    // the API hands out, and this shape is what feeds it.
    const config = loadConfig({ OPENAI_API_KEY: 'sk-secret' }, '/srv/app')
    expect(JSON.stringify(config)).not.toContain('sk-secret')
  })
})
