import type { ProjectSpec } from '@vudt/spec'

/**
 * Replaces the template's tokens.css with actual colors from spec.theme.
 * Blocks read only these variables, never inline colors, so a theme change
 * propagates by editing this one file.
 */
export function renderTokensCss(spec: ProjectSpec): string {
  const { colorTokens, radius, spacing, fontPair } = spec.theme

  const radiusValue =
    radius === 'none' ? '0' : radius === 'sm' ? '0.25rem' : radius === 'md' ? '0.5rem' : radius === 'lg' ? '0.75rem' : '999px'

  const spaceValue =
    spacing === 'compact' ? '0.75rem' : spacing === 'relaxed' ? '1.25rem' : '1rem'

  return (
    `/*\n` +
    ` * The generator replaces these values from spec.theme.colorTokens. Every block\n` +
    ` * reads tokens only — no block hardcodes a color, so a theme change is a\n` +
    ` * one-file edit.\n` +
    ` */\n` +
    `:root {\n` +
    `  --color-primary: ${colorTokens.primary};\n` +
    `  --color-secondary: ${colorTokens.secondary};\n` +
    `  --color-accent: ${colorTokens.accent};\n` +
    `  --color-background: ${colorTokens.background};\n` +
    `  --color-surface: ${colorTokens.surface};\n` +
    `  --color-foreground: ${colorTokens.foreground};\n` +
    `  --color-muted: ${colorTokens.muted};\n\n` +
    `  --radius: ${radiusValue};\n` +
    `  --space-unit: ${spaceValue};\n\n` +
    `  --font-heading: '${fontPair.heading}', system-ui, sans-serif;\n` +
    `  --font-body: '${fontPair.body}', system-ui, sans-serif;\n` +
    `}\n`
  )
}
