import { mkdir, rm } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BuildError } from './errors.js'

const TASK_ID_PATTERN = /^[0-9a-z][0-9a-z-]{0,63}$/

export interface TaskWorkspace {
  taskId: string
  /** The project root: where the template is materialized and the build runs. */
  dir: string
  /** Removes the whole task directory. */
  dispose(): Promise<void>
}

/**
 * Hands out one directory per task under a single root.
 *
 * Every path the pipeline touches is derived from this directory, and `within()`
 * is the only way to build a child path — a generated route or asset hash that
 * tried to climb out would otherwise reach the platform's own files.
 */
export class WorkspaceRoot {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  get path(): string {
    return this.root
  }

  /** Rejects anything that is not a plain lowercase slug — it becomes a path segment. */
  private validateId(taskId: string): void {
    if (!TASK_ID_PATTERN.test(taskId)) {
      throw new BuildError(`invalid task id: ${JSON.stringify(taskId)}`)
    }
  }

  async allocate(taskId: string = randomUUID()): Promise<TaskWorkspace> {
    this.validateId(taskId)
    const dir = join(this.root, taskId)
    // Fresh directory per task: a leftover dist or node_modules from a previous
    // run would make the next build's output impossible to attribute.
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })

    return {
      taskId,
      dir,
      dispose: async () => {
        await rm(dir, { recursive: true, force: true })
      },
    }
  }
}

/** Resolves `relPath` inside `base`, refusing anything that escapes it. */
export function within(base: string, relPath: string): string {
  const baseResolved = resolve(base)
  const target = resolve(baseResolved, relPath)
  const rel = relative(baseResolved, target)
  if (rel === '' || rel.startsWith('..') || rel.startsWith(`..${sep}`) || resolve(rel) === rel) {
    throw new BuildError(`path "${relPath}" escapes ${baseResolved}`)
  }
  return target
}
