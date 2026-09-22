import type { Asset, Page, ProjectSpec } from '@vudt/spec'
import { getBlockDefinition, getSlot } from '@vudt/blocks'
import { CodegenError } from './errors.js'
import { assetHref, pageComponentName } from './naming.js'

/** Serializes a prop value the model supplied into a JS literal. */
function literal(value: unknown): string {
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

function assetsById(spec: ProjectSpec): Map<string, Asset> {
  return new Map(spec.assets.map((asset) => [asset.id, asset]))
}

/**
 * Builds the `assets` object for one block.
 *
 * `w`/`h` come from the sidecar via `getSlot()`, never from the manifest entry.
 * There is deliberately only one source of truth for geometry; the manifest
 * value is still compared against it and a disagreement throws, because that
 * would mean the derivation contract was bypassed somewhere upstream.
 */
function renderBlockAssets(
  page: Page,
  blockIndex: number,
  byId: Map<string, Asset>,
): string | undefined {
  const block = page.blocks[blockIndex]!
  const definition = getBlockDefinition(block.component)
  if (!definition) {
    throw new CodegenError(
      `route "${page.route}" block ${blockIndex} uses unknown component "${block.component}"`,
    )
  }

  const entries: string[] = []
  for (const [slotName, assetId] of Object.entries(block.assetBindings)) {
    const slot = getSlot(block.component, slotName)
    if (!slot) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} (${block.component}) binds slot "${slotName}",` +
          ` which the component does not declare (declares: ` +
          `${definition.slots.map((s) => s.name).join(', ') || 'none'})`,
      )
    }

    const asset = byId.get(assetId)
    if (!asset) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} (${block.component}) slot "${slotName}"` +
          ` binds unknown asset id "${assetId}"`,
      )
    }

    if (asset.renderSize.w !== slot.renderSize.w || asset.renderSize.h !== slot.renderSize.h) {
      throw new CodegenError(
        `asset "${asset.id}" declares renderSize ${asset.renderSize.w}x${asset.renderSize.h} but` +
          ` ${block.component}.${slotName} sidecar says ` +
          `${slot.renderSize.w}x${slot.renderSize.h}`,
      )
    }

    entries.push(
      `  ${JSON.stringify(slotName)}: {\n` +
        `    src: ${JSON.stringify(assetHref(asset.contentHash))},\n` +
        `    alt: ${JSON.stringify(asset.alt)},\n` +
        `    w: ${slot.renderSize.w},\n` +
        `    h: ${slot.renderSize.h},\n` +
        `  },`,
    )
  }

  if (entries.length === 0) return undefined
  return `{\n${entries.join('\n')}\n}`
}

/** Renders one spec page into a Vue SFC. */
export function renderPage(spec: ProjectSpec, page: Page): string {
  const byId = assetsById(spec)
  const components = [...new Set(page.blocks.map((block) => block.component))].sort()

  const imports = components
    .map((component) => `import ${component} from '../blocks/${component}.vue'`)
    .join('\n')

  const consts: string[] = []
  const usages: string[] = []
  let needsSlotAssets = false

  for (const [blockIndex, block] of page.blocks.entries()) {
    // A spec does not have to come from the draft path — a template preset or a
    // hand-edited spec reaches this function directly. Rendering a nav here would
    // put a second one under the shell's, reintroducing through the side door the
    // exact bug the layout work removed.
    if (getBlockDefinition(block.component)?.layoutOnly === true) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} is the layout component "${block.component}",` +
          ` which App.vue already renders around every page — remove it from pages[].blocks`,
      )
    }

    const attrs: string[] = []

    // Props go into a script const bound with v-bind rather than inline into
    // attributes. An inline JSON literal would need HTML-entity escaping, and
    // vue-tsc reads the raw attribute text before entities are decoded — so
    // `:headline="&quot;x&quot;"` builds fine under vite but fails typecheck.
    const propEntries = Object.entries(block.props).filter(([, v]) => v !== undefined)
    if (propEntries.length > 0) {
      const name = `props${blockIndex}`
      const body = propEntries
        .map(([key, value]) => `  ${JSON.stringify(key)}: ${literal(value)},`)
        .join('\n')
      consts.push(`const ${name} = {\n${body}\n}`)
      attrs.push(`v-bind="${name}"`)
    }

    const assetsLiteral = renderBlockAssets(page, blockIndex, byId)
    if (assetsLiteral) {
      needsSlotAssets = true
      const name = `assets${blockIndex}`
      consts.push(`const ${name}: SlotAssets = ${assetsLiteral}`)
      attrs.push(`:assets="${name}"`)
    }

    usages.push(renderTag(block.component, attrs))
  }

  const scriptLines = [
    needsSlotAssets ? `import type { SlotAssets } from '../asset'` : undefined,
    imports,
    consts.length > 0 ? '' : undefined,
    ...consts,
  ].filter((line): line is string => line !== undefined)

  return (
    `<script setup lang="ts">\n` +
    `${scriptLines.join('\n')}\n` +
    `</script>\n\n` +
    `<template>\n` +
    `${usages.join('\n')}\n` +
    `</template>\n`
  )
}

function renderTag(component: string, attrs: readonly string[]): string {
  if (attrs.length === 0) return `  <${component} />`
  if (attrs.length === 1 && attrs[0]!.length < 80) return `  <${component} ${attrs[0]} />`
  return `  <${component}\n${attrs.map((a) => `    ${a}`).join('\n')}\n  />`
}

export { pageComponentName }
