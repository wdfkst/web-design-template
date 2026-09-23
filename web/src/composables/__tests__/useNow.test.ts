import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '../useNow.js'

// 模块级状态在同一个文件里跨用例存活，所以每条用例都必须把自己注册的消费者
// stop 掉，否则下一条的 getTimerCount 会读到上一条留下的定时器。
describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shares one clock between consumers', async () => {
    const first = useNow(() => true)
    const second = useNow(() => true)

    try {
      expect(first.now).toBe(second.now)
      expect(vi.getTimerCount()).toBe(1)

      // 推进一个间隔后，共享值应当跟上系统时间 —— 时钟确实在走，且两个消费者读的是同一个。
      await vi.advanceTimersByTimeAsync(1_000)
      expect(first.now.value).toBe(Date.now())
    } finally {
      first.stop()
      second.stop()
    }
  })

  it('does not advance while no consumer is active', async () => {
    const idle = useNow(() => false)

    try {
      const before = idle.now.value

      vi.setSystemTime(Date.now() + 3_000)
      await vi.advanceTimersByTimeAsync(3_000)

      expect(idle.now.value).toBe(before)
    } finally {
      idle.stop()
    }
  })

  it('clears the interval once every consumer is gone', () => {
    const first = useNow(() => true)
    const second = useNow(() => true)

    try {
      expect(vi.getTimerCount()).toBe(1)

      first.stop()
      expect(vi.getTimerCount()).toBe(1)

      second.stop()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      first.stop()
      second.stop()
    }
  })
})
