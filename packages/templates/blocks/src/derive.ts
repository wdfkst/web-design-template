import type { AssetInput, Block } from '@vudt/spec'
import type { SlotContent } from './slot.js'
import { getBlockDefinition, listBlockComponents } from './registry.js'

/** One block the caller (template preset or LLM) wants on a page. */
export interface BlockSelection {
  component: string
  props?: Record<string, unknown>
  /** Subject text per slot name. Geometry cannot be overridden here by design. */
  content?: Record<string, SlotContent>
}

export interface DerivedPageAssets {
  /** Spec-shaped blocks with `assetBindings` already wired to the ids below. */
  blocks: Block[]
  /** Baseline manifest entries, geometry taken verbatim from the sidecars. */
  assets: AssetInput[]
}

export class BlockDerivationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockDerivationError'
  }
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
}

/**
 * Ids are derived from position rather than from anything the model writes, so
 * the same block appearing twice on a page yields distinct, stable ids.
 */
function assetId(route: string, blockIndex: number, component: string, slotName: string): string {
  const routePart = toKebab(route) || 'index'
  return `${routePart}-${blockIndex}-${toKebab(component)}-${toKebab(slotName)}`
}

/**
 * Turns a chosen block combination into baseline manifest entries.
 *
 * This is the zero-mismatch path: every aspectRatio/renderSize/transparent/
 * composition value comes straight from the component's own sidecar, so a
 * derived asset cannot contradict the container the code generator emits. The
 * LLM only fills in subject text, and only for slots that actually exist —
 * an unknown slot name is an error rather than a silently ignored key.
 */
export function derivePageAssets(
  route: string,
  selections: readonly BlockSelection[],
): DerivedPageAssets {
  const blocks: Block[] = []
  const assets: AssetInput[] = []

  for (const [blockIndex, selection] of selections.entries()) {
    const definition = getBlockDefinition(selection.component)
    if (!definition) {
      throw new BlockDerivationError(
        `unknown block component "${selection.component}" on route "${route}"` +
          ` (available: ${listBlockComponents().join(', ')})`,
      )
    }

    // A layout is rendered once by the app shell, not per page. Letting one into
    // `pages[].blocks` would put a second nav on the page — the bug this contract
    // exists to prevent. It is its own case rather than folded into "unknown
    // component" because that message sends the model looking for a replacement
    // block instead of deleting the one it should never have picked.
    if (definition.layoutOnly === true) {
      throw new BlockDerivationError(
        `block "${definition.component}" on route "${route}" is a project-level layout,` +
          ` not a page block: the app shell already renders it once around every page.` +
          ` Remove it from pages[].blocks.`,
      )
    }

    const content = selection.content ?? {}
    for (const slotName of Object.keys(content)) {
      if (!definition.slots.some((slot) => slot.name === slotName)) {
        throw new BlockDerivationError(
          `block "${definition.component}" has no slot "${slotName}"` +
            ` (declares: ${definition.slots.map((s) => s.name).join(', ') || 'none'})`,
        )
      }
    }

    const assetBindings: Record<string, string> = {}
    for (const slot of definition.slots) {
      const id = assetId(route, blockIndex, definition.component, slot.name)
      const supplied = content[slot.name]
      assetBindings[slot.name] = id
      assets.push({
        id,
        purpose: slot.purpose,
        aspectRatio: slot.aspectRatio,
        renderSize: { ...slot.renderSize },
        transparent: slot.transparent,
        composition: slot.composition,
        prompt: supplied?.prompt ?? slot.defaultPrompt,
        alt: supplied?.alt ?? slot.defaultAlt,
      })
    }

    blocks.push({
      component: definition.component,
      props: selection.props ?? {},
      assetBindings,
    })
  }

  return { blocks, assets }
}

/** Merges per-page derivations, rejecting id collisions across pages. */
export function mergeDerivedAssets(parts: readonly DerivedPageAssets[]): AssetInput[] {
  const byId = new Map<string, AssetInput>()
  for (const part of parts) {
    for (const asset of part.assets) {
      if (byId.has(asset.id)) {
        throw new BlockDerivationError(`duplicate derived asset id "${asset.id}"`)
      }
      byId.set(asset.id, asset)
    }
  }
  return [...byId.values()]
}

interface FoundTarget {
  /** Dotted path inside the component's props, for the retry prompt. */
  path: string
  value: unknown
}

/**
 * Walks a prop tree collecting every value stored under a `to` key. Nested
 * shapes count: `plans[].cta.to` is as much a destination as `primaryCta.to`.
 */
function collectTargets(value: unknown, path: string, found: FoundTarget[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTargets(item, `${path}[${index}]`, found))
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`
    if (key === 'to') {
      found.push({ path: childPath, value: child })
      continue
    }
    collectTargets(child, childPath, found)
  }
}

/**
 * A prop named `to` is a destination inside this project, and the only thing a
 * destination can name is a route some page declared. The convention is total on
 * purpose: a new block cannot forget to declare that one of its props is a
 * route, because there is nothing to declare.
 *
 * Anchors are rejected outright. With hash history an `#id` link cannot reach
 * another page, and "the click did nothing" is the exact symptom this exists to
 * remove.
 */
export function assertCtaTargets(
  route: string,
  selections: readonly BlockSelection[],
  routes: ReadonlySet<string>,
): void {
  for (const selection of selections) {
    const found: FoundTarget[] = []
    collectTargets(selection.props ?? {}, selection.component, found)

    for (const { path, value } of found) {
      if (typeof value !== 'string' || value === '') {
        throw new BlockDerivationError(
          `${route}: ${path} must be a string route naming a declared page`,
        )
      }
      if (value.startsWith('#')) {
        throw new BlockDerivationError(
          `${route}: ${path} is the anchor "${value}", and an anchor cannot reach another page.` +
            ` Use the route of a page declared in "pages" instead.`,
        )
      }
      if (!routes.has(value)) {
        throw new BlockDerivationError(
          `${route}: ${path} points at "${value}", which is not a declared route` +
            ` (declared: ${[...routes].join(', ')})`,
        )
      }
    }
  }
}
