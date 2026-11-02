import { deriveSpecInput } from '@vudt/blocks'
import { applyAdminStyle, resolveAdminStyle, finalizeSpec, parseProjectSpecInput, type AdminStyleReference, type ProjectSpec, type ProjectSpecInput } from '@vudt/spec'
import { ServerError } from './errors.js'

export interface SpecDraftRequest {
  description: string
  /** Validation feedback from the previous attempt, to be appended to the prompt. */
  feedback?: string
  attempt: number
  adminStyle?: AdminStyleReference
}

/**
 * The seam between the API and whichever model writes the spec. Kept this narrow
 * so retry-on-invalid-JSON lives here, in one place, instead of inside a route.
 */
export interface SpecDrafter {
  readonly name: string
  draft(request: SpecDraftRequest): Promise<unknown>
}

export interface DraftSpecOptions {
  maxAttempts?: number
  adminStyle?: AdminStyleReference
  adminStyleSeed?: number
  /** 每次尝试的模型调用之前触发，1-based。 */
  onAttempt?: (attempt: number) => void
  onValidation?: (state: 'started' | 'succeeded' | 'failed') => void
}

const DEFAULT_MAX_ATTEMPTS = 3

/**
 * Asks the drafter for a draft until it derives into a spec that passes Zod.
 *
 * Two gates, in this order:
 *   1. `deriveSpecInput` — the draft's shape, plus geometry and asset ids from
 *      the block sidecars. The model never writes those.
 *   2. `parseProjectSpecInput` — the spec schema proper. It is what catches
 *      duplicate routes, which derivation does not look at.
 *
 * Both failures are carried back verbatim: the schema is the platform's only
 * defence against structural drift, so the fix for a rejected draft is a better
 * prompt, never a looser schema.
 */
export async function draftSpec(
  drafter: SpecDrafter,
  description: string,
  options: DraftSpecOptions = {},
): Promise<{ spec: ProjectSpec; input: ProjectSpecInput; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const adminStyle = options.adminStyle === undefined ? undefined : { ...options.adminStyle }
  if (adminStyle !== undefined && resolveAdminStyle(adminStyle) === undefined) {
    throw new ServerError(`unsupported admin style: ${adminStyle.id}@${adminStyle.version}`)
  }
  const seed = adminStyle === undefined ? 0 : options.adminStyleSeed ?? Math.floor(Math.random() * 0x80000000)
  let feedback: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.onAttempt?.(attempt)
    const raw = await drafter.draft({
      description, attempt,
      ...(feedback === undefined ? {} : { feedback }),
      ...(adminStyle === undefined ? {} : { adminStyle: { ...adminStyle } }),
    })

    options.onValidation?.('started')
    let candidate = raw
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      if (adminStyle !== undefined) {
        const applied = applyAdminStyle(raw, adminStyle, seed)
        if (!applied.ok) {
          options.onValidation?.('failed')
          feedback = applied.feedback
          continue
        }
        candidate = applied.value
      } else {
        const { adminStyle: _untrusted, ...legacy } = raw as Record<string, unknown>
        candidate = legacy
      }
    }
    // Malformed JSON/primitives keep the original shape-validator feedback.
    const derived = deriveSpecInput(candidate)
    if (!derived.ok) {
      options.onValidation?.('failed')
      feedback = derived.feedback
      continue
    }

    const parsed = parseProjectSpecInput(derived.value)
    if (parsed.ok) {
      options.onValidation?.('succeeded')
      return { spec: finalizeSpec(parsed.value), input: parsed.value, attempts: attempt }
    }
    options.onValidation?.('failed')
    feedback = parsed.feedback
  }

  throw new ServerError(
    `the model did not produce a valid spec in ${maxAttempts} attempts`,
    422,
    feedback,
  )
}
