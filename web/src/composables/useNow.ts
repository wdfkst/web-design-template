import { onUnmounted, ref, type Ref } from 'vue'

const DEFAULT_INTERVAL_MS = 1000

/**
 * 全应用一个时钟。列表页有 N 行，每行一个 setInterval 就是 N 个定时器；这里
 * 只留一个，靠一张注册表把各消费者的 active 断言收在一起。
 */
const now = ref(Date.now())
const consumers = new Set<() => boolean>()
let timer: ReturnType<typeof setInterval> | undefined

/** 只要还有**任一**消费者 active 就推进；全不 active 时空转不写，不触发重渲染。 */
function tick(): void {
  for (const active of consumers) {
    if (active()) {
      now.value = Date.now()
      return
    }
  }
}

export interface UseNow {
  /** 共享的当前时刻（毫秒）。 */
  now: Ref<number>
  /** 注销本消费者；最后一个注销时定时器被清掉。 */
  stop: () => void
}

/**
 * 消费这个时钟。`active` 每次都重新求值 —— 传一个闭包即可，不必是响应式的。
 *
 * 间隔由**第一个**消费者决定，后来的沿用同一个定时器。
 */
export function useNow(active: () => boolean, intervalMs = DEFAULT_INTERVAL_MS): UseNow {
  consumers.add(active)
  timer ??= setInterval(tick, intervalMs)

  let stopped = false
  function stop(): void {
    if (stopped) return
    stopped = true
    consumers.delete(active)
    if (consumers.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  onUnmounted(stop)
  return { now, stop }
}
