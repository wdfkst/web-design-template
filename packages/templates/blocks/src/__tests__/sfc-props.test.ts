import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_REGISTRY } from '../registry.js'

const templateBlocksDir = fileURLToPath(new URL('../../../vue3-base/src/blocks/', import.meta.url))

function readSfc(component: string): string {
  return readFileSync(`${templateBlocksDir}${component}.vue`, 'utf8')
}

/**
 * Prop names out of the one `defineProps<{ … }>()` literal every block declares.
 * `assets` is filtered out: the code generator injects it from the block's
 * `assetBindings`, so the model must never be asked for it.
 */
function extractPropNames(sfc: string): string[] {
  const block = /defineProps<\{([\s\S]*?)\}>\(\)/.exec(sfc)
  expect(block, 'SFC has no defineProps<{ … }>() literal').not.toBeNull()
  return (block![1]!.match(/^\s{4}(\w+)\??:/gm) ?? [])
    .map((line) => line.trim().replace(/\??:$/, ''))
    .filter((name) => name !== 'assets')
}

/**
 * Without this, renaming a prop in an SFC would leave the prompt advertising a
 * key the component no longer accepts — the model's copy then lands nowhere and
 * the page renders empty text, which nothing else in the pipeline would catch.
 */
describe('sidecar props match the props their components accept', () => {
  for (const definition of BLOCK_REGISTRY.values()) {
    it(`${definition.component} declares exactly the props its SFC accepts`, () => {
      const fromSfc = extractPropNames(readSfc(definition.component))
      expect(Object.keys(definition.props).sort()).toEqual([...fromSfc].sort())
    })
  }

  it('never asks the model for the injected assets prop', () => {
    for (const definition of BLOCK_REGISTRY.values()) {
      expect(definition.props).not.toHaveProperty('assets')
    }
  })

  it('StatusCard tone classes name selectors that exist in its own style block', () => {
    // A dead class survives every dynamic test — StatusCard once shipped a
    // TONE_CLASS mapping to `__tone--*` while the CSS targeted `__item--*`,
    // and 109 green tests did not catch it. Pin every mapped value to a
    // selector that actually appears in the same file's <style>.
    const sfc = readSfc('StatusCard')
    const mapping = /const TONE_CLASS: Record<string, string> = \{([\s\S]*?)\}/.exec(sfc)
    expect(mapping, 'SFC has a TONE_CLASS mapping').not.toBeNull()
    const values = mapping![1]!.match(/'([^']+)'/g) ?? []
    expect(values.length).toBeGreaterThan(0)
    for (const value of values) {
      const selector = value.replace(/^'|'$/g, '')
      expect(sfc).toContain(`.${selector}`)
    }
  })
})
