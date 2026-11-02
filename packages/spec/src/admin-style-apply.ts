import { resolveAdminStyle, type AdminStyleReference } from './admin-style.js'
import { effectiveStyleBible } from './effective-style.js'
import { StyleBibleSchema } from './style-bible.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function applyAdminStyle(
  raw: unknown,
  ref: AdminStyleReference,
  seed: number,
): { ok: true; value: unknown } | { ok: false; feedback: string } {
  const definition = resolveAdminStyle(ref)
  if (!definition) return { ok: false, feedback: 'Unsupported adminStyle reference/version' }
  if (!isObject(raw) || !isObject(raw.experience) || raw.experience.kind !== 'admin') {
    return { ok: false, feedback: 'Selected adminStyle requires an object with experience.kind = admin' }
  }
  const suppliedSeed = StyleBibleSchema.shape.seed.safeParse(isObject(raw.styleBible) ? raw.styleBible.seed : undefined)
  const selectedSeed = suppliedSeed.success ? suppliedSeed : StyleBibleSchema.shape.seed.safeParse(seed)
  if (!selectedSeed.success) return { ok: false, feedback: 'adminStyle requires a valid nonnegative integer seed' }
  const theme = definition.theme
  const experience = { ...raw.experience, kind: 'admin' as const, presentation: definition.presentation }
  const styleBible = {
    ...definition.styleBible,
    material: definition.material,
    palette: [],
    seed: selectedSeed.data,
  }
  return {
    ok: true,
    value: {
      ...raw,
      adminStyle: { id: definition.id, version: definition.version },
      theme,
      experience,
      styleBible: effectiveStyleBible({ theme, experience, styleBible }),
    },
  }
}
