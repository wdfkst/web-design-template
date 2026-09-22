import type { TaskView } from '../api/client.js'

/**
 * Mirrors the server's gate, which checks whether the workspace directory exists
 * rather than whether the task succeeded. `runTask` leaves the workspace in place
 * on failure, and that source is the main way to debug a failed build. The
 * workspace is allocated only after drafting succeeds, so the earlier statuses
 * have nothing to export.
 */
export function canExportSource(task: TaskView): boolean {
  return task.status === 'building' || task.status === 'ready' || task.status === 'failed'
}

/** dist exists only when the build finished. */
export function canExportDist(task: TaskView): boolean {
  return task.status === 'ready'
}
