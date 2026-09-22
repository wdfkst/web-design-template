import type { AspectRatio, AssetPurpose } from '@vudt/spec'
import { z } from 'zod'

/**
 * One image hole in a block component. The geometry fields here are the whole
 * point of the sidecar: they are authored by humans alongside the component's
 * markup, so the container the code writes and the picture the image side
 * generates can never disagree. The LLM is allowed to influence the subject
 * (prompt/alt) but never the shape.
 */
export interface SlotSpec {
  /** Slot name as it appears in the component's `assetBindings`. */
  name: string
  purpose: AssetPurpose
  aspectRatio: AspectRatio
  /** Container size the code generator writes into the markup. */
  renderSize: { w: number; h: number }
  transparent: boolean
  composition: 'subject-left' | 'subject-right' | 'centered' | 'full-bleed'
  /** Subject fallback, used when the caller supplies no prompt for this slot. */
  defaultPrompt: string
  defaultAlt: string
}

export interface BlockDefinition {
  /** PascalCase, matches `Block.component` in the spec. */
  component: string
  /** Which page types this block is sensible on; advisory, not enforced. */
  pageTypes: readonly string[]
  /**
   * Props the LLM may set, as `name -> shape note`. A list or object prop carries
   * its shape in the note: `BlockSchema.props` is validated as `unknown`, so a
   * wrong shape only shows up as empty markup in the preview. `assets` is absent
   * on purpose — the code generator injects it from `assetBindings`.
   */
  props: Readonly<Record<string, string>>
  slots: readonly SlotSpec[]
}

/** Per-slot subject text the LLM may supply. Geometry is deliberately absent. */
export const SlotContentSchema = z.object({
  prompt: z.string().min(3).max(600).optional(),
  alt: z.string().min(1).max(200).optional(),
})

export type SlotContent = z.infer<typeof SlotContentSchema>
