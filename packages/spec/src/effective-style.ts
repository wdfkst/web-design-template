import type { AdminExperience } from './admin.js'
import type { ProjectSpecInput } from './project-spec.js'
import type { StyleBible } from './style-bible.js'

type StyleInput = Pick<ProjectSpecInput, 'theme' | 'styleBible'> & {
  experience?: Pick<AdminExperience, 'kind' | 'presentation'> | { kind: 'marketing' } | undefined
}

export function effectiveStyleBible(input: StyleInput): StyleBible {
  const palette = input.experience?.kind === 'admin' && input.experience.presentation
    ? [input.theme.colorTokens.primary, input.theme.colorTokens.secondary, input.theme.colorTokens.accent]
    : [...input.styleBible.palette]
  return { ...input.styleBible, palette }
}
