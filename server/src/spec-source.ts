import { deriveSpecInput } from '@vudt/blocks'
import { finalizeSpec, parseProjectSpecInput, type ProjectSpec, type ProjectSpecInput } from '@vudt/spec'
import { ServerError } from './errors.js'

export interface SpecDraftRequest {
  description: string
  /** Validation feedback from the previous attempt, to be appended to the prompt. */
  feedback?: string
  attempt: number
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
  let feedback: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = await drafter.draft(
      feedback === undefined ? { description, attempt } : { description, feedback, attempt },
    )

    const derived = deriveSpecInput(raw)
    if (!derived.ok) {
      feedback = derived.feedback
      continue
    }

    const parsed = parseProjectSpecInput(derived.value)
    if (parsed.ok) {
      return { spec: finalizeSpec(parsed.value), input: parsed.value, attempts: attempt }
    }
    feedback = parsed.feedback
  }

  throw new ServerError(
    `the model did not produce a valid spec in ${maxAttempts} attempts`,
    422,
    feedback,
  )
}
