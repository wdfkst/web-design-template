import { describe, expect, it } from 'vitest'
import { assetFilePath, assetHref, pageComponentName, routeName } from '../naming.js'

describe('pageComponentName', () => {
  it('maps the root route to HomePage', () => {
    expect(pageComponentName('/')).toBe('HomePage')
  })

  it('pascal-cases nested and hyphenated routes', () => {
    expect(pageComponentName('/pricing')).toBe('PricingPage')
    expect(pageComponentName('/docs/api')).toBe('DocsApiPage')
    expect(pageComponentName('/empty-state')).toBe('EmptyStatePage')
  })

  it('turns params into a readable segment', () => {
    expect(pageComponentName('/users/:id')).toBe('UsersByIdPage')
  })
})

describe('routeName', () => {
  it('names the root route home', () => {
    expect(routeName('/')).toBe('home')
  })

  it('joins nested segments', () => {
    expect(routeName('/docs/api')).toBe('docs-api')
    expect(routeName('/users/:id')).toBe('users-by-id')
  })
})

describe('asset paths', () => {
  it('uses a relative href so base: "./" keeps working in the iframe', () => {
    expect(assetHref('abc123')).toBe('./assets/abc123.png')
  })

  it('writes into public/ so vite copies it verbatim', () => {
    expect(assetFilePath('abc123')).toBe('public/assets/abc123.png')
  })
})
