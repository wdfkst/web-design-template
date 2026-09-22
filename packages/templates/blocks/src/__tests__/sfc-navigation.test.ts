import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_REGISTRY } from '../registry.js'

const blockSfcDir = fileURLToPath(new URL('../../../vue3-base/src/blocks/', import.meta.url))

function readSfc(component: string): string {
  return readFileSync(`${blockSfcDir}${component}.vue`, 'utf8')
}

/**
 * The symptom this whole design exists to kill: a hardcoded `href="#cta"` looks
 * like navigation and is not. The router runs on hash history, so an in-page
 * anchor can only move the scroll position — and only when some element happens
 * to carry that id. A cross-page destination has to be a real route.
 */
describe('block SFCs navigate with router-link, never with an anchor', () => {
  for (const definition of BLOCK_REGISTRY.values()) {
    it(`${definition.component} hardcodes no anchor href`, () => {
      expect(readSfc(definition.component)).not.toMatch(/href="#/)
    })
  }

  it('LogoStrip renders brand names as plain text, with nothing to click', () => {
    const sfc = readSfc('LogoStrip')
    expect(sfc).not.toContain('<a')
    expect(sfc).not.toContain('href')
  })

  it('EmptyStatePanel offers a real route instead of a button that does nothing', () => {
    const sfc = readSfc('EmptyStatePanel')
    expect(sfc).not.toContain('<button')
    expect(sfc).toContain('<router-link')
  })
})
