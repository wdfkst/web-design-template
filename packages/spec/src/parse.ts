import { z } from 'zod'
import { ProjectSpecInputSchema, ProjectSpecSchema } from './project-spec.js'
import type { ProjectSpec, ProjectSpecInput } from './project-spec.js'

export type ParseFailure = {
  ok: false
  /** Newline-joined `path: message` lines, ready to append to a retry prompt. */
  feedback: string
  issues: z.core.$ZodIssue[]
}

export type ParseSuccess<T> = { ok: true; value: T }
export type ParseResult<T> = ParseSuccess<T> | ParseFailure

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(root)'
  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : `.${String(segment)}`))
    .join('')
    .replace(/^\./, '')
}

/**
 * Turns validation failures into text the model can act on. The retry loop is
 * only as good as this message, so each line names the exact path and rule.
 */
export function formatIssues(issues: readonly z.core.$ZodIssue[]): string {
  return issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`).join('\n')
}

function toResult<T>(parsed: z.ZodSafeParseResult<T>): ParseResult<T> {
  if (parsed.success) return { ok: true, value: parsed.data }
  return {
    ok: false,
    feedback: formatIssues(parsed.error.issues),
    issues: parsed.error.issues,
  }
}

/** Validates raw model output before any downstream stage touches it. */
export function parseProjectSpecInput(raw: unknown): ParseResult<ProjectSpecInput> {
  return toResult(ProjectSpecInputSchema.safeParse(raw))
}

/** Validates a spec that already carries derived content hashes. */
export function parseProjectSpec(raw: unknown): ParseResult<ProjectSpec> {
  return toResult(ProjectSpecSchema.safeParse(raw))
}
