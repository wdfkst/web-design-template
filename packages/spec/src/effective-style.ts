import type { ProjectSpecInput } from './project-spec.js'
import type { StyleBible } from './style-bible.js'

export function effectiveStyleBible(input: ProjectSpecInput): StyleBible {
  const palette = input.experience?.kind === 'admin' && input.experience.presentation
    ? [input.theme.colorTokens.primary, input.theme.colorTokens.secondary, input.theme.colorTokens.accent]
    : [...input.styleBible.palette]
  return { ...input.styleBible, palette }
}
