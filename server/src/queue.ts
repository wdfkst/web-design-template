export type QueueJob = () => Promise<void>

/**
 * Bounded FIFO queue with a small concurrency cap.
 *
 * A build spawns vite (which spawns workers) and may call an image model, so the
 * expensive resource is the box, not the event loop. Running tasks unbounded
 * would let a handful of requests exhaust CPU and memory that the per-task
 * sandbox limits cannot reclaim, because those limits are per process.
 */
export class TaskQueue {
  private readonly concurrency: number
  private readonly maxPending: number
  private readonly pending: QueueJob[] = []
  private running = 0
  private idleWaiters: Array<() => void> = []

  constructor(options: { concurrency?: number; maxPending?: number } = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 1)
    this.maxPending = Math.max(1, options.maxPending ?? 32)
  }

  get depth(): number {
    return this.pending.length
  }

  get active(): number {
    return this.running
  }

  /** Returns false when the queue is full, so the route can answer 503 instead of buffering forever. */
  enqueue(job: QueueJob): boolean {
    if (this.pending.length >= this.maxPending) return false
    this.pending.push(job)
    queueMicrotask(() => {
      this.pump()
    })
    return true
  }

  /** Resolves when nothing is running or pending. Test affordance. */
  async drain(): Promise<void> {
    if (this.running === 0 && this.pending.length === 0) return
    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve)
    })
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()
      if (job === undefined) break
      this.running += 1
      // Jobs are expected to record their own failures on the task record; an
      // escaped rejection must still free the slot or the queue wedges shut.
      void job()
        .catch(() => undefined)
        .finally(() => {
          this.running -= 1
          this.pump()
          this.settleIdle()
        })
    }
    this.settleIdle()
  }

  private settleIdle(): void {
    if (this.running > 0 || this.pending.length > 0) return
    const waiters = this.idleWaiters
    this.idleWaiters = []
    for (const waiter of waiters) waiter()
  }
}
