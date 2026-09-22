import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #4f46e5')

/**
 * Keys are fixed rather than a free-form record so palette derivation into the
 * style bible stays mechanical instead of guesswork.
 */
export const ColorTokensSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  foreground: hexColor,
  muted: hexColor,
})

export const ThemeSchema = z.object({
  colorTokens: ColorTokensSchema,
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']),
  spacing: z.enum(['compact', 'normal', 'relaxed']),
  fontPair: z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  }),
  mode: z.enum(['light', 'dark', 'both']),
})

export type ColorTokens = z.infer<typeof ColorTokensSchema>
export type Theme = z.infer<typeof ThemeSchema>
