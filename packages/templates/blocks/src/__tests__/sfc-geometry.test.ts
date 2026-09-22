import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_REGISTRY } from '../registry.js'

const templateBlocksDir = fileURLToPath(new URL('../../../vue3-base/src/blocks/', import.meta.url))

function readSfc(component: string): string {
  return readFileSync(`${templateBlocksDir}${component}.vue`, 'utf8')
}

/**
 * Pulls every `<img data-asset-slot="…" … width="…" height="…">` out of an SFC.
 * The slot name may be bound (`:data-asset-slot="SLOT_NAMES[index]"`), in which
 * case there is one tag covering several slots — recorded under '*'.
 */
function extractSlotBoxes(sfc: string): Map<string, { w: number; h: number }> {
  const boxes = new Map<string, { w: number; h: number }>()
  for (const tag of sfc.match(/<img[\s\S]*?\/>/g) ?? []) {
    const slot = /\sdata-asset-slot="([^"]+)"/.exec(tag)
    const bound = /\s:data-asset-slot="[^"]+"/.test(tag)
    if (!slot && !bound) continue
    const width = /\swidth="(\d+)"/.exec(tag)
    const height = /\sheight="(\d+)"/.exec(tag)
    expect(width, `img in SFC is missing an explicit width: ${tag.slice(0, 60)}`).not.toBeNull()
    expect(height, `img in SFC is missing an explicit height: ${tag.slice(0, 60)}`).not.toBeNull()
    boxes.set(slot ? slot[1]! : '*', { w: Number(width![1]), h: Number(height![1]) })
  }
  return boxes
}

/**
 * The sidecar is only a contract if the markup actually honours it. Without this
 * test, editing a renderSize in a `*.slots.ts` file would generate images at one
 * size while the SFC kept reserving a box at the old one — a silently squashed
 * illustration that no other check would catch.
 */
describe('SFC containers match their sidecar geometry', () => {
  for (const definition of BLOCK_REGISTRY.values()) {
    it(`${definition.component} declares a box for every slot it owns`, () => {
      const boxes = extractSlotBoxes(readSfc(definition.component))
      const shared = boxes.get('*')

      if (definition.slots.length === 0) {
        expect(boxes.size, 'slotless block should render no asset img').toBe(0)
        return
      }

      for (const slot of definition.slots) {
        const box = boxes.get(slot.name) ?? shared
        expect(box, `no asset img found for slot "${slot.name}"`).toBeDefined()
        expect(box, `${definition.component}.${slot.name}`).toEqual(slot.renderSize)
      }
    })
  }

  it('renders no asset img for a slot the sidecar never declared', () => {
    for (const definition of BLOCK_REGISTRY.values()) {
      const declared = new Set(definition.slots.map((slot) => slot.name))
      for (const name of extractSlotBoxes(readSfc(definition.component)).keys()) {
        if (name === '*') continue
        expect(declared.has(name), `${definition.component} binds undeclared slot "${name}"`).toBe(
          true,
        )
      }
    }
  })
})
