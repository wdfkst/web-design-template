/** Raised when a task cannot be set up or its build fails/violates a limit. */
export class BuildError extends Error {
  constructor(
    message: string,
    readonly detail?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null },
  ) {
    super(message)
    this.name = 'BuildError'
  }
}
