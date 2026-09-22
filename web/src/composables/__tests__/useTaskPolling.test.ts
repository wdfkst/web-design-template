import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskPolling } from '../useTaskPolling.js'
import * as client from '../../api/client.js'

function taskAt(status: client.TaskStatus): client.TaskView {
  return { id: 'abc', status, description: 'x', createdAt: 1 }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useTaskPolling', () => {
  it('fetches the task immediately on start', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('ready'))

    const polling = useTaskPolling('abc')
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(getTask).toHaveBeenCalledWith('abc')
    expect(polling.task.value?.status).toBe('ready')
  })

  it('keeps polling while the task is active', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('building'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(getTask).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(getTask).toHaveBeenCalledTimes(2)

    polling.stop()
  })

  it('stops as soon as the task reaches ready', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('ready'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(10000)
    expect(getTask).toHaveBeenCalledTimes(1)
  })

  it('stops as soon as the task reaches failed', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('failed'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(10000)
    expect(getTask).toHaveBeenCalledTimes(1)
  })

  it('stop() clears the pending timer', async () => {
    const getTask = vi.spyOn(client, 'getTask').mockResolvedValue(taskAt('queued'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    polling.stop()

    await vi.advanceTimersByTimeAsync(10000)
    expect(getTask).toHaveBeenCalledTimes(1)
  })

  it('flags a 404 separately so the view can redirect', async () => {
    vi.spyOn(client, 'getTask').mockRejectedValue(new client.ApiError('unknown task', 404))

    const polling = useTaskPolling('abc')
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(polling.notFound.value).toBe(true)
  })

  it('keeps polling through a transient error', async () => {
    const getTask = vi
      .spyOn(client, 'getTask')
      .mockRejectedValueOnce(new client.ApiError('boom', 500))
      .mockResolvedValue(taskAt('ready'))

    const polling = useTaskPolling('abc', { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(polling.error.value).toBe('boom')

    await vi.advanceTimersByTimeAsync(1000)
    expect(getTask).toHaveBeenCalledTimes(2)
    expect(polling.error.value).toBeUndefined()
  })
})
