import { describe, expect, it } from 'vitest'
import { getSlot } from '@vudt/blocks'
import type { ProjectSpec } from '@vudt/spec'
import { CodegenError } from '../errors.js'
import { renderPage } from '../page.js'
import { landingSpec } from './fixture.js'

function homePage(spec: ProjectSpec) {
  return spec.pages.find((page) => page.route === '/')!
}

describe('renderPage', () => {
  it('imports each distinct block component exactly once', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const imports = [...sfc.matchAll(/^import (\w+) from '\.\.\/blocks\/(\w+)\.vue'$/gm)]
    const names = imports.map((m) => m[1])
    expect(names).toEqual(['CtaBanner', 'FeatureTriad', 'HeroSplit', 'StatsBand'])
    expect(new Set(names).size).toBe(names.length)
  })

  it('emits one tag per block, in spec order', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const template = sfc.slice(sfc.indexOf('<template>'))
    const order = [...template.matchAll(/<([A-Z]\w+)/g)].map((m) => m[1])
    expect(order).toEqual(['HeroSplit', 'StatsBand', 'FeatureTriad', 'CtaBanner'])
  })

  it('takes w/h from the sidecar, not from the manifest entry', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const slot = getSlot('HeroSplit', 'illustration')!
    expect(sfc).toContain(`w: ${slot.renderSize.w}`)
    expect(sfc).toContain(`h: ${slot.renderSize.h}`)
  })

  it('references images by contentHash under ./assets/', () => {
    const spec = landingSpec()
    const heroAsset = spec.assets.find((a) => a.id.includes('hero-split'))!
    const sfc = renderPage(spec, homePage(spec))
    expect(sfc).toContain(`src: "./assets/${heroAsset.contentHash}.png"`)
  })

  it('declares an assets const only for blocks that have slots', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    // StatsBand (index 1) is slotless; the other three each own slot images.
    expect(sfc).not.toContain('const assets1')
    expect(sfc).toContain('const assets0: SlotAssets')
    expect(sfc).toContain('const assets2: SlotAssets')
    expect(sfc).toContain('const assets3: SlotAssets')
  })

  it('keeps prop values in the script block, never inline in attributes', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const template = sfc.slice(sfc.indexOf('<template>'))

    // Quotes and ampersands survive verbatim as a JS string in the script…
    expect(sfc).toContain('"subhead": "A \\"quoted\\" & ampersanded subhead"')
    // …and the template only ever references the const, so no HTML entity
    // escaping is needed and vue-tsc sees a plain identifier.
    expect(template).toContain('v-bind="props0"')
    expect(template).not.toContain('&quot;')
    expect(template).not.toContain('subhead')
  })

  it('binds props and assets separately so blocks without slots stay bare', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    expect(sfc).toContain('const props0 = {')
    expect(sfc).toContain('const props1 = {')
    expect(sfc).not.toContain('const assets1')
  })

  it('throws when a page carries a layout component the shell already renders', () => {
    const spec = landingSpec()
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          route: '/bare',
          title: 'Bare',
          pageType: 'landing',
          blocks: [{ component: 'NavBarSimple', props: {}, assetBindings: {} }],
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(CodegenError)
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(
      /NavBarSimple.*already renders around every page/,
    )
  })
})

describe('renderPage contract violations', () => {
  it('throws when a block binds a slot the component does not declare', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          ...page,
          blocks: page.blocks.map((block, index) =>
            index === 1
              ? { ...block, assetBindings: { ...block.assetBindings, sidebar: 'whatever' } }
              : block,
          ),
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(CodegenError)
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(/does not declare/)
  })

  it('throws when a binding points at an asset the manifest lacks', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    const broken: ProjectSpec = {
      ...spec,
      assets: spec.assets.filter((asset) => !asset.id.includes('hero-split')),
      pages: [page],
    }
    expect(() => renderPage(broken, page)).toThrow(/unknown asset id/)
  })

  it('throws when a manifest renderSize drifts from the sidecar', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    const drifted: ProjectSpec = {
      ...spec,
      assets: spec.assets.map((asset) =>
        asset.id.includes('hero-split')
          ? { ...asset, renderSize: { w: 900, h: 675 } }
          : asset,
      ),
      pages: [page],
    }
    expect(() => renderPage(drifted, page)).toThrow(/sidecar says/)
  })

  it('throws on an unknown component', () => {
    const spec = landingSpec()
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          route: '/x',
          title: 'X',
          pageType: 'landing',
          blocks: [{ component: 'NotARealBlock', props: {}, assetBindings: {} }],
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(/unknown component/)
  })
})
