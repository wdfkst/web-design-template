import archiver, { type Archiver } from 'archiver'
import { join } from 'node:path'
import { ServerError } from './errors.js'

/** Same shape the build package enforces: the id becomes a path segment. */
export const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/**
 * Turns a task id into its workspace directory. Validation comes first because
 * the id arrives from the URL and lands in a filesystem path; `join` alone would
 * happily resolve `../`.
 */
export function resolveTaskDir(workspaceRoot: string, taskId: string): string {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new ServerError(`invalid task id: ${JSON.stringify(taskId)}`, 400)
  }
  return join(workspaceRoot, taskId)
}

function newArchive(): Archiver {
  // store-only for dist (already-compressed assets dominate) would save CPU, but
  // source trees are mostly text, so deflate earns its keep.
  return archiver('zip', { zlib: { level: 9 } })
}

/**
 * The project source, ready to hand to a developer.
 *
 * `node_modules` is a junction into the shared template, so `followSymlinks`
 * must stay off: a naive recursive walk would descend into the template and
 * produce a multi-hundred-megabyte archive. Excluding the glob is the first
 * line of defence, not following links is the second.
 */
export function createSourceArchive(taskDir: string): Archiver {
  const archive = newArchive()
  archive.glob('**/*', {
    cwd: taskDir,
    dot: true,
    follow: false,
    ignore: ['node_modules/**', 'node_modules', 'dist/**', 'dist'],
  })
  return archive
}

/** The built site, with dist/ itself as the archive root. */
export function createDistArchive(taskDir: string): Archiver {
  const archive = newArchive()
  archive.glob('**/*', { cwd: join(taskDir, 'dist'), dot: true, follow: false })
  return archive
}
