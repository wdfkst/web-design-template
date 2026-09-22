import { onUnmounted, ref, type Ref } from 'vue'
import {
  ACTIVE_STATUSES,
  ApiError,
  createTask as createTaskRequest,
  listTasks,
  type TaskView,
} from '../api/client.js'

const DEFAULT_INTERVAL_MS = 1500

export interface UseTaskList {
  tasks: Ref<TaskView[]>
  loading: Ref<boolean>
  error: Ref<string | undefined>
  refresh: () => Promise<void>
  start: () => void
  stop: () => void
  submit: (description: string) => Promise<TaskView | undefined>
}

function hasActive(tasks: readonly TaskView[]): boolean {
  return tasks.some((task) => ACTIVE_STATUSES.includes(task.status))
}

/**
 * Polls the task list, but only while something is actually in flight: an
 * all-terminal list cannot change on its own, so polling it would be pure noise.
 */
export function useTaskList(options: { intervalMs?: number } = {}): UseTaskList {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const tasks = ref<TaskView[]>([])
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function stop(): void {
    stopped = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function describe(cause: unknown): string {
    return cause instanceof ApiError ? cause.message : '请求失败'
  }

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      tasks.value = await listTasks()
      error.value = undefined
    } catch (cause) {
      error.value = describe(cause)
    } finally {
      loading.value = false
    }
  }

  function scheduleNext(): void {
    if (stopped || !hasActive(tasks.value)) return
    timer = setTimeout(tick, intervalMs)
  }

  async function tick(): Promise<void> {
    await refresh()
    scheduleNext()
  }

  function start(): void {
    stopped = false
    void tick()
  }

  async function submit(description: string): Promise<TaskView | undefined> {
    try {
      const created = await createTaskRequest(description)
      error.value = undefined
      await refresh()
      // A brand-new task is active, so resume polling even if the list had gone quiet.
      start()
      return created
    } catch (cause) {
      error.value = describe(cause)
      return undefined
    }
  }

  // Timers outlive components unless cleared; this is the leak this guards.
  onUnmounted(stop)

  return { tasks, loading, error, refresh, start, stop, submit }
}
