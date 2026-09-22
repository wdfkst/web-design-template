import type { Asset, StyleBible } from '@vudt/spec'

/**
 * Turns the style bible into the prefix every prompt in the project shares.
 * Order matters: style first, subject second. Providers weight leading tokens
 * more heavily, and cross-asset visual consistency is the whole point of the
 * bible — it must not be outranked by one asset's subject description.
 */
export function styleBiblePrefix(bible: StyleBible): string {
  const parts = [`${bible.artStyle.replace(/-/g, ' ')} illustration`]

  if (bible.lineWeight !== 'none') parts.push(`${bible.lineWeight} line weight`)
  if (bible.shading !== 'none') parts.push(`${bible.shading.replace(/-/g, ' ')} shading`)
  parts.push(`${bible.perspective.replace(/-/g, ' ')} perspective`)
  parts.push(`color palette ${bible.palette.join(', ')}`)

  return parts.join(', ')
}

const COMPOSITION_INSTRUCTION: Record<Asset['composition'], string> = {
  // The negative space is load-bearing: the block puts copy in the other half,
  // so a centered subject here means text lands on top of the artwork.
  'subject-left': 'subject positioned in the left half, empty negative space on the right',
  'subject-right': 'subject positioned in the right half, empty negative space on the left',
  centered: 'subject centered with even margins on all sides',
  'full-bleed': 'composition fills the entire frame edge to edge, no margins',
}

export function compositionInstruction(composition: Asset['composition']): string {
  return COMPOSITION_INSTRUCTION[composition]
}

/** Background phrasing depends on transparency, so the two must be decided together. */
export function backgroundInstruction(asset: Asset, bible: StyleBible): string {
  return asset.transparent
    ? 'isolated subject on a fully transparent background, no backdrop, no shadow plate'
    : `${bible.backgroundTreatment.replace(/-/g, ' ')} background`
}

export interface BuiltPrompt {
  prompt: string
  negativePrompt: string
  seed: number
}

/**
 * Assembles the final provider request text. Deterministic: same asset + bible
 * always yields the same string, which is what makes contentHash a valid cache
 * key — if this function grew a random or time-dependent term the cache would
 * start returning images that no longer match their prompt.
 */
export function buildPrompt(asset: Asset, bible: StyleBible): BuiltPrompt {
  const segments = [
    styleBiblePrefix(bible),
    asset.prompt,
    compositionInstruction(asset.composition),
    backgroundInstruction(asset, bible),
  ]

  const negatives = [bible.negativePrompt, 'text, watermark, signature, ui chrome, borders']
  if (asset.transparent) negatives.push('background, backdrop, ground shadow')

  return {
    prompt: segments.filter((s) => s.length > 0).join('. '),
    negativePrompt: negatives.filter((s) => s.length > 0).join(', '),
    seed: bible.seed,
  }
}
