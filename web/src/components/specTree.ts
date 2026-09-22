import type { SpecView } from '../api/client.js'

export interface TreeNode {
  key: string
  title: string
  kind: 'page' | 'block' | 'asset'
  children?: TreeNode[]
  route?: string
  assetId?: string
}

/**
 * Turns the spec projection into the tree that makes this console worth having:
 * page → block → the slot each asset is bound to. Seeing the slot name next to
 * the asset is how a wrong binding becomes visible at a glance.
 */
export function buildTreeData(spec: SpecView): TreeNode[] {
  return spec.pages.map((page, pageIndex) => {
    const blocks: TreeNode[] = page.blocks.map((block, blockIndex) => {
      const bindings = Object.entries(block.assetBindings)
      const assets: TreeNode[] = bindings.map(([slot, assetId]) => ({
        key: `p${pageIndex}-b${blockIndex}-${slot}`,
        title: `${slot} → ${assetId}`,
        kind: 'asset' as const,
        assetId,
      }))

      return {
        key: `p${pageIndex}-b${blockIndex}`,
        title: block.component,
        kind: 'block' as const,
        // Omit the array entirely when empty: a-tree renders an expander for [].
        ...(assets.length === 0 ? {} : { children: assets }),
      }
    })

    return {
      key: `p${pageIndex}`,
      title: `${page.route}  ${page.name}`,
      kind: 'page' as const,
      route: page.route,
      ...(blocks.length === 0 ? {} : { children: blocks }),
    }
  })
}
