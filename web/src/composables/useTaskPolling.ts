import { onUnmounted, ref, type Ref } from 'vue'
import { ACTIVE_STATUSES, ApiError, getTask, type TaskView } from '../api/client.js'

const DEFAULT_INTERVAL_MS = 1500

export interface UseTaskPolling {
  task: Ref<TaskView | undefined>
  error: Ref<string | undefined>
  notFound: Ref<boolean>
  start: () => void
  stop: () => void
}

/**
 * Polls one task until it reaches a terminal status, then stops on its own.
 *
 * A 404 is kept separate from other errors: it means the task is gone (the store
 * is in-memory and does not survive a restart), which the view answers by going
 * back to the list rather than by retrying.
 */
export function useTaskPolling(
  taskId: string,
  options: { intervalMs?: number } = {},
): UseTaskPolling {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const task = ref<TaskView | undefined>(undefined)
  const error = ref<string | undefined>(undefined)
  const notFound = ref(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function stop(): void {
    stopped = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function isActive(): boolean {
    const current = task.value
    return current === undefined || ACTIVE_STATUSES.includes(current.status)
  }

  async function tick(): Promise<void> {
    try {
      task.value = await getTask(taskId)
      error.value = undefined
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        notFound.value = true
        stop()
        return
      }
      // Transient failures must not end the watch: the task is still running.
      error.value = cause instanceof ApiError ? cause.message : '请求失败'
    }

    if (stopped || !isActive()) return
    timer = setTimeout(tick, intervalMs)
  }

  function start(): void {
    stopped = false
    void tick()
  }

  onUnmounted(stop)

  return { task, error, notFound, start, stop }
}
