import { describe, expect, it } from 'vitest'
import { buildTreeData } from '../specTree.js'
import type { SpecView } from '../../api/client.js'

function specWith(pages: SpecView['pages'], assets: SpecView['assets'] = []): SpecView {
  return {
    meta: { name: 'Acme', description: 'd', targetStack: 'vue3' },
    theme: {},
    styleBible: {},
    pages,
    assets,
  }
}

describe('buildTreeData', () => {
  it('makes one node per page, keyed by route', () => {
    const tree = buildTreeData(
      specWith([
        { route: '/', name: 'Home', blocks: [] },
        { route: '/about', name: 'About', blocks: [] },
      ]),
    )

    expect(tree).toHaveLength(2)
    expect(tree[0]!.kind).toBe('page')
    expect(tree[0]!.route).toBe('/')
    expect(tree[1]!.route).toBe('/about')
  })

  it('nests blocks under their page', () => {
    const tree = buildTreeData(
      specWith([
        {
          route: '/',
          name: 'Home',
          blocks: [
            { component: 'HeroBlock', props: {}, assetBindings: {} },
            { component: 'FeatureGrid', props: {}, assetBindings: {} },
          ],
        },
      ]),
    )

    expect(tree[0]!.children).toHaveLength(2)
    expect(tree[0]!.children![0]!.kind).toBe('block')
    expect(tree[0]!.children![0]!.title).toContain('HeroBlock')
  })

  it('nests bound assets under their block and labels the slot', () => {
    const tree = buildTreeData(
      specWith(
        [
          {
            route: '/',
            name: 'Home',
            blocks: [
              { component: 'HeroBlock', props: {}, assetBindings: { image: 'hero-art' } },
            ],
          },
        ],
        [
          {
            id: 'hero-art',
            prompt: 'a robot',
            alt: 'robot',
            aspectRatio: '16:9',
            renderSize: { w: 1280, h: 720 },
            transparent: false,
            contentHash: '0123456789abcdef',
          },
        ],
      ),
    )

    const assetNode = tree[0]!.children![0]!.children![0]!
    expect(assetNode.kind).toBe('asset')
    expect(assetNode.assetId).toBe('hero-art')
    // The slot name is the whole point of this view: it shows where the image lands.
    expect(assetNode.title).toContain('image')
    expect(assetNode.title).toContain('hero-art')
  })

  it('leaves a block with no bindings childless rather than empty-parented', () => {
    const tree = buildTreeData(
      specWith([
        { route: '/', name: 'Home', blocks: [{ component: 'TextBlock', props: {}, assetBindings: {} }] },
      ]),
    )

    expect(tree[0]!.children![0]!.children).toBeUndefined()
  })

  it('produces unique keys across pages that reuse the same component', () => {
    const tree = buildTreeData(
      specWith([
        { route: '/', name: 'Home', blocks: [{ component: 'HeroBlock', props: {}, assetBindings: {} }] },
        { route: '/b', name: 'B', blocks: [{ component: 'HeroBlock', props: {}, assetBindings: {} }] },
      ]),
    )

    const keys = [tree[0]!.children![0]!.key, tree[1]!.children![0]!.key]
    expect(new Set(keys).size).toBe(2)
  })
})
