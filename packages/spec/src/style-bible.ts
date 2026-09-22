import { z } from 'zod'

/**
 * The single source of truth for how every illustration in one project looks.
 * Each image prompt is built as: style bible prefix + that asset's own prompt.
 */
export const StyleBibleSchema = z.object({
  artStyle: z.enum([
    'flat-vector',
    'isometric',
    'hand-drawn',
    'gradient-mesh',
    '3d-clay',
    'line-art',
    'paper-cut',
  ]),
  lineWeight: z.enum(['none', 'thin', 'medium', 'bold']),
  shading: z.enum(['none', 'flat', 'soft-gradient', 'dramatic']),
  perspective: z.enum(['front', 'isometric', 'top-down', 'three-quarter']),
  /** Derived from theme.colorTokens so illustrations share the UI's color family. */
  palette: z.array(z.string()).min(2).max(8),
  /** Applies only to assets whose `transparent` is false. */
  backgroundTreatment: z.enum(['solid', 'subtle-gradient', 'scene', 'abstract-shapes']),
  negativePrompt: z.string().default(''),
  /** Fixed per project so re-runs stay visually stable. */
  seed: z.number().int().nonnegative(),
})

export type StyleBible = z.infer<typeof StyleBibleSchema>
