import { onUnmounted, ref, watch, type Ref } from 'vue'
import { getObservability, type ObservabilitySnapshot, type TaskView } from '../api/client.js'

export function useTaskObservability(taskId: string, task: Ref<TaskView | undefined>) {
  const data = ref<ObservabilitySnapshot>()
  const error = ref<string>()
  let disposed = false
  let sequence = 0
  let pending = false
  async function refresh() {
    const current = ++sequence
    pending = true
    try {
      const next = await getObservability(taskId)
      if (disposed || current !== sequence) return
      data.value = next
      error.value = undefined
    } catch {
      if (!disposed && current === sequence) error.value = '请求记录暂时无法加载，请重试。'
    } finally {
      if (current === sequence) pending = false
    }
  }
  watch(task, (next, previous) => {
    if (next && ((!pending && (!data.value || error.value)) || next.revision !== previous?.revision || next.status !== previous?.status)) void refresh()
  }, { immediate: true })
  onUnmounted(() => { disposed = true; sequence++ })
  return { data, error, refresh }
}
