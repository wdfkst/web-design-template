import { describe, expect, it } from 'vitest'
import { TaskQueue } from '../queue.js'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('TaskQueue', () => {
  it('runs jobs one at a time by default', async () => {
    const queue = new TaskQueue()
    const order: string[] = []
    const first = deferred()

    queue.enqueue(async () => {
      order.push('first:start')
      await first.promise
      order.push('first:end')
    })
    queue.enqueue(async () => {
      order.push('second:start')
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(order).toEqual(['first:start'])

    first.resolve()
    await queue.drain()
    expect(order).toEqual(['first:start', 'first:end', 'second:start'])
  })

  it('honours a concurrency above one', async () => {
    const queue = new TaskQueue({ concurrency: 2 })
    let peak = 0
    let running = 0
    const gate = deferred()

    for (let i = 0; i < 4; i += 1) {
      queue.enqueue(async () => {
        running += 1
        peak = Math.max(peak, running)
        await gate.promise
        running -= 1
      })
    }

    await new Promise((r) => setTimeout(r, 10))
    expect(peak).toBe(2)
    gate.resolve()
    await queue.drain()
    expect(peak).toBe(2)
  })

  it('refuses work past maxPending instead of buffering it', async () => {
    const queue = new TaskQueue({ concurrency: 1, maxPending: 2 })
    const gate = deferred()

    expect(queue.enqueue(async () => { await gate.promise })).toBe(true)
    expect(queue.enqueue(async () => {})).toBe(true)
    // Slot three: the first two are still pending, so this is over the cap.
    expect(queue.enqueue(async () => {})).toBe(false)

    gate.resolve()
    await queue.drain()
  })

  it('frees the slot when a job rejects', async () => {
    const queue = new TaskQueue()
    const ran: string[] = []

    queue.enqueue(async () => {
      ran.push('boom')
      throw new Error('boom')
    })
    queue.enqueue(async () => {
      ran.push('after')
    })

    await queue.drain()
    expect(ran).toEqual(['boom', 'after'])
  })
})
