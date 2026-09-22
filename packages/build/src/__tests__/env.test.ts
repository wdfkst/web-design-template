import { describe, expect, it } from 'vitest'
import { sandboxEnv } from '../env.js'

describe('sandboxEnv', () => {
  it('drops variables that are not on the allowlist', () => {
    const env = sandboxEnv({
      PATH: '/usr/bin',
      OPENAI_API_KEY: 'sk-secret',
      AWS_SECRET_ACCESS_KEY: 'secret',
      SOME_INTERNAL_TOKEN: 'secret',
    })
    expect(env.PATH).toBe('/usr/bin')
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(env.SOME_INTERNAL_TOKEN).toBeUndefined()
  })

  it('never leaks a value merely because it looks harmless', () => {
    const env = sandboxEnv({ PATH: '/usr/bin', NEW_UNKNOWN_VAR: 'x' })
    expect(Object.keys(env)).not.toContain('NEW_UNKNOWN_VAR')
  })

  it('disables install scripts', () => {
    expect(sandboxEnv({}).npm_config_ignore_scripts).toBe('true')
  })

  it('points proxies at a dead address when the network is blocked', () => {
    const env = sandboxEnv({ PATH: '/usr/bin' })
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:9')
    expect(env.NO_PROXY).toBe('')
  })

  it('leaves proxies unset when the network is allowed', () => {
    const env = sandboxEnv({ PATH: '/usr/bin' }, { network: 'allowed' })
    expect(env.HTTPS_PROXY).toBeUndefined()
  })

  it('applies caller-vouched extras last', () => {
    const env = sandboxEnv({ PATH: '/usr/bin' }, { extra: { CI: '0' } })
    expect(env.CI).toBe('0')
  })
})
