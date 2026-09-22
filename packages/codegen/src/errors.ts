/**
 * Raised when a spec would produce a project that contradicts itself — an
 * asset bound to a slot the block never declared, a manifest renderSize that
 * disagrees with the sidecar, a binding to a missing asset. These are contract
 * violations, not user errors: the spec schema plus sidecar derivation are
 * supposed to make them unreachable, so the message names the exact join that
 * broke rather than degrading to a placeholder image.
 */
export class CodegenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CodegenError'
  }
}
