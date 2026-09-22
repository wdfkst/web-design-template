import { describe, expect, it } from 'vitest'
import { buildPrompt, styleBiblePrefix } from '../prompt.js'
import { landingSpec } from './fixture.js'

const spec = landingSpec()
const bible = spec.styleBible
const asset = spec.assets[0]!

describe('styleBiblePrefix', () => {
  it('leads with the art style and includes the palette', () => {
    const prefix = styleBiblePrefix(bible)
    expect(prefix.startsWith('flat vector illustration')).toBe(true)
    expect(prefix).toContain('color palette #4f46e5, #0ea5e9, #f59e0b')
  })

  it('omits line weight and shading when they are none', () => {
    const prefix = styleBiblePrefix({ ...bible, lineWeight: 'none', shading: 'none' })
    expect(prefix).not.toContain('line weight')
    expect(prefix).not.toContain('shading')
  })
})

describe('buildPrompt', () => {
  it('puts the style prefix before the asset subject', () => {
    const { prompt } = buildPrompt(asset, bible)
    expect(prompt.indexOf('flat vector illustration')).toBeLessThan(prompt.indexOf(asset.prompt))
  })

  it('translates composition into a negative-space instruction', () => {
    const left = buildPrompt({ ...asset, composition: 'subject-left' }, bible).prompt
    const right = buildPrompt({ ...asset, composition: 'subject-right' }, bible).prompt
    expect(left).toContain('negative space on the right')
    expect(right).toContain('negative space on the left')
  })

  it('asks for a transparent backdrop and negates the background for transparent assets', () => {
    const { prompt, negativePrompt } = buildPrompt({ ...asset, transparent: true }, bible)
    expect(prompt).toContain('fully transparent background')
    expect(negativePrompt).toContain('background')
  })

  it('uses the style bible background treatment for opaque assets', () => {
    const { prompt } = buildPrompt({ ...asset, transparent: false }, bible)
    expect(prompt).toContain('subtle gradient background')
  })

  it('carries the project seed so re-runs stay stable', () => {
    expect(buildPrompt(asset, bible).seed).toBe(bible.seed)
  })

  it('is deterministic', () => {
    expect(buildPrompt(asset, bible)).toEqual(buildPrompt(asset, bible))
  })
})
