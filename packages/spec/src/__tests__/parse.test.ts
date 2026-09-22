import { describe, expect, it } from 'vitest'
import { parseProjectSpecInput } from '../parse.js'
import { validSpecInput } from './fixture.js'

describe('parseProjectSpecInput', () => {
  it('accepts a valid spec', () => {
    const result = parseProjectSpecInput(validSpecInput())
    expect(result.ok).toBe(true)
  })

  it('rejects a binding that references an undeclared asset', () => {
    const spec = validSpecInput()
    spec.pages[0]!.blocks[0]!.assetBindings = { illustration: 'does-not-exist' }

    const result = parseProjectSpecInput(spec)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('unknown asset id "does-not-exist"')
    expect(result.feedback).toContain('assetBindings.illustration')
  })

  it('rejects duplicate asset ids', () => {
    const spec = validSpecInput()
    spec.assets.push({ ...spec.assets[0]! })

    const result = parseProjectSpecInput(spec)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('duplicate asset id "hero-main"')
  })

  it('rejects a renderSize that contradicts the declared aspectRatio', () => {
    const spec = validSpecInput()
    spec.assets[0]!.renderSize = { w: 600, h: 600 }

    const result = parseProjectSpecInput(spec)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('does not match')
    expect(result.feedback).toContain('4:3')
  })

  it('rejects duplicate routes', () => {
    const spec = validSpecInput()
    spec.pages.push({ ...spec.pages[0]! })

    const result = parseProjectSpecInput(spec)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('duplicate route "/"')
  })

  it('reports malformed model output without throwing', () => {
    const result = parseProjectSpecInput({ meta: { name: 'x' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.feedback).not.toBe('')
  })

  it('names the exact path in feedback so a retry can be targeted', () => {
    const spec = validSpecInput()
    spec.assets[0]!.aspectRatio = '5:4' as never

    const result = parseProjectSpecInput(spec)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.feedback).toContain('assets[0].aspectRatio')
  })
})
