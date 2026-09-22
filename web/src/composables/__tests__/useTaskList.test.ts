import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskList } from '../useTaskList.js'
import * as client from '../../api/client.js'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useTaskList', () => {
  it('loads tasks on refresh', async () => {
    vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'ready', description: 'x', createdAt: 1 },
    ])

    const list = useTaskList()
    await list.refresh()

    expect(list.tasks.value).toHaveLength(1)
    expect(list.loading.value).toBe(false)
  })

  it('keeps polling while a task is still active', async () => {
    const listTasks = vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'building', description: 'x', createdAt: 1 },
    ])

    const list = useTaskList({ intervalMs: 1000 })
    list.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(listTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(listTasks).toHaveBeenCalledTimes(2)

    list.stop()
  })

  it('stops polling once every task reached a terminal status', async () => {
    const listTasks = vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'ready', description: 'x', createdAt: 1 },
      { id: 'b', status: 'failed', description: 'y', createdAt: 2 },
    ])

    const list = useTaskList({ intervalMs: 1000 })
    list.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(listTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    // No active task left, so no further requests.
    expect(listTasks).toHaveBeenCalledTimes(1)
  })

  it('stop() clears the timer so nothing fires afterwards', async () => {
    const listTasks = vi.spyOn(client, 'listTasks').mockResolvedValue([
      { id: 'a', status: 'building', description: 'x', createdAt: 1 },
    ])

    const list = useTaskList({ intervalMs: 1000 })
    list.start()
    await vi.advanceTimersByTimeAsync(0)
    list.stop()

    await vi.advanceTimersByTimeAsync(10000)
    expect(listTasks).toHaveBeenCalledTimes(1)
  })

  it('surfaces an ApiError message instead of throwing', async () => {
    vi.spyOn(client, 'listTasks').mockRejectedValue(new client.ApiError('boom', 500))

    const list = useTaskList()
    await list.refresh()

    expect(list.error.value).toBe('boom')
  })

  it('submit() creates a task and refreshes the list', async () => {
    const createTask = vi.spyOn(client, 'createTask').mockResolvedValue({
      id: 'new',
      status: 'queued',
      description: 'a landing page',
      createdAt: 3,
    })
    vi.spyOn(client, 'listTasks').mockResolvedValue([])

    const list = useTaskList()
    const created = await list.submit('a landing page')

    expect(createTask).toHaveBeenCalledWith('a landing page')
    expect(created?.id).toBe('new')
  })

  it('submit() reports a full queue without throwing', async () => {
    vi.spyOn(client, 'createTask').mockRejectedValue(
      new client.ApiError('queue is full, retry later', 503),
    )
    vi.spyOn(client, 'listTasks').mockResolvedValue([])

    const list = useTaskList()
    const created = await list.submit('x')

    expect(created).toBeUndefined()
    expect(list.error.value).toContain('queue is full')
  })
})
