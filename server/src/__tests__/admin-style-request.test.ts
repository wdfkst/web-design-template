import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app.js'
import { runTask } from '../runner.js'
import { MemorySettingsStore } from '../settings-store.js'
import { TaskStore, type TaskRecord } from '../store.js'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
})

async function makeApp(maxPending = 32) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'vudt-style-request-'))
  const draft = vi.fn(async () => { throw new Error('test stops before building') })
  const drafter = vi.fn(() => ({ name: 'request-test', draft }))
  const provider = vi.fn(() => { throw new Error('unexpected image provider') })
  const settingsStore = new MemorySettingsStore()
  const app = buildApp({
    workspaceRoot, templateDir: workspaceRoot, drafter, provider, settingsStore, maxPending,
  })
  cleanups.push(async () => {
    await app.vudt.queue.drain()
    await app.close()
    await rm(workspaceRoot, { recursive: true, force: true })
  })
  return { app, draft, drafter, provider, settingsStore, workspaceRoot }
}

function historical(id: string, adminStyle?: { id: 'soft'; version: number }): TaskRecord {
  return {
    id, description: 'coffee admin', ownerId: 'owner', createdAt: 0, status: 'failed',
    ...(adminStyle === undefined ? {} : { adminStyle }),
  }
}

describe('admin style task requests', () => {
  it('passes the stored choice through the runner to drafting', async () => {
    const { app, draft } = await makeApp()
    await app.inject({ method: 'POST', url: '/tasks', payload: { description: 'coffee', adminStyleId: 'aurora' } })
    await app.vudt.queue.drain()
    expect(draft).toHaveBeenCalledWith(expect.objectContaining({ adminStyle: { id: 'aurora', version: 1 } }))
  })

  it('keeps an omitted selection absent from creation, detail, list and retry', async () => {
    const { app, draft } = await makeApp()
    const response = await app.inject({ method: 'POST', url: '/tasks', payload: { description: 'legacy' } })
    expect(response.statusCode).toBe(202)
    expect(response.json()).not.toHaveProperty('adminStyle')
    await app.vudt.queue.drain()
    expect(draft).toHaveBeenCalledTimes(1)
    const id = response.json().id
    expect((await app.inject(`/tasks/${id}`)).json()).not.toHaveProperty('adminStyle')
    expect((await app.inject('/tasks')).json().tasks[0]).not.toHaveProperty('adminStyle')
    const retry = await app.inject({ method: 'POST', url: `/tasks/${id}/retry` })
    expect(retry.statusCode).toBe(202)
    expect(retry.json()).not.toHaveProperty('adminStyle')
  })

  it.each(['soft', 'warm', 'mist', 'porcelain', 'aurora'])('snapshots %s as server version 1 in every task view', async id => {
    const { app } = await makeApp()
    const response = await app.inject({ method: 'POST', url: '/tasks', payload: { description: 'coffee', adminStyleId: id } })
    expect(response.statusCode).toBe(202)
    expect(response.json().adminStyle).toEqual({ id, version: 1 })
    const taskId = response.json().id
    expect(app.vudt.store.get(taskId)).toHaveProperty('adminStyle', { id, version: 1 })
    expect((await app.inject(`/tasks/${taskId}`)).json().adminStyle).toEqual({ id, version: 1 })
    expect((await app.inject('/tasks')).json().tasks[0].adminStyle).toEqual({ id, version: 1 })
  })

  it.each([null, '', 'unknown', 1, [], {}])('rejects explicit invalid selection %j without recording or enqueueing', async adminStyleId => {
    const { app, drafter, provider } = await makeApp()
    const response = await app.inject({ method: 'POST', url: '/tasks', payload: { description: 'coffee', adminStyleId } })
    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/adminStyleId/)
    expect(app.vudt.store.list()).toEqual([])
    await app.vudt.queue.drain()
    expect(drafter).not.toHaveBeenCalled()
    expect(provider).not.toHaveBeenCalled()
  })

  it('ignores client versions and forged references, returning only the trusted reference', async () => {
    const { app } = await makeApp()
    const response = await app.inject({ method: 'POST', url: '/tasks', payload: {
      description: 'coffee', adminStyleId: 'soft', version: 999,
      adminStyle: { id: 'aurora', version: 999, material: 'untrusted' },
    } })
    expect(response.statusCode).toBe(202)
    expect(response.json().adminStyle).toEqual({ id: 'soft', version: 1 })
  })

  it('retries with a separate copy of the original reference and current settings', async () => {
    const { app, settingsStore } = await makeApp()
    app.vudt.store.create({ ...historical('original', { id: 'soft', version: 1 }), settings: settingsStore.resolved().settings })
    await settingsStore.save({ ...settingsStore.current(), spec: { ...settingsStore.current().spec, model: 'new-model' } })
    const response = await app.inject({ method: 'POST', url: '/tasks/original/retry', payload: { adminStyleId: 'aurora' } })
    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({ description: 'coffee admin', adminStyle: { id: 'soft', version: 1 } })
    const original = app.vudt.store.get('original')!
    const retried = app.vudt.store.get(response.json().id)!
    expect(retried).toMatchObject({ ownerId: 'owner', settings: { spec: { model: 'new-model' } } })
    expect(retried.adminStyle).not.toBe(original.adminStyle)
    expect(original.settings?.spec.model).not.toBe('new-model')
    expect(original.status).toBe('failed')
  })

  it('fails an unsupported historical version before constructing either model provider', async () => {
    const { app, drafter, draft, provider, settingsStore, workspaceRoot } = await makeApp()
    app.vudt.store.create(historical('unsupported', { id: 'soft', version: 99 }))
    await runTask('unsupported', {
      store: app.vudt.store, workspaces: app.vudt.workspaces, drafter, provider,
      settings: settingsStore.resolved().settings, templateDir: workspaceRoot, maxAssets: 24, specAttempts: 3,
    })
    expect(app.vudt.store.get('unsupported')).toMatchObject({ status: 'failed', error: { message: expect.stringMatching(/admin.*style.*soft.*99/i) } })
    expect(drafter).not.toHaveBeenCalled()
    expect(draft).not.toHaveBeenCalled()
    expect(provider).not.toHaveBeenCalled()
  })

  it('does not upgrade an unsupported historical version on retry or call a model', async () => {
    const { app, drafter, provider } = await makeApp()
    app.vudt.store.create(historical('unsupported', { id: 'soft', version: 99 }))
    const response = await app.inject({ method: 'POST', url: '/tasks/unsupported/retry' })
    expect(response.statusCode).toBe(202)
    expect(response.json().adminStyle).toEqual({ id: 'soft', version: 99 })
    await app.vudt.queue.drain()
    expect((await app.inject(`/tasks/${response.json().id}`)).json()).toMatchObject({
      status: 'failed', adminStyle: { id: 'soft', version: 99 }, error: { message: expect.stringMatching(/admin.*style.*99/i) },
    })
    expect(drafter).not.toHaveBeenCalled()
    expect(provider).not.toHaveBeenCalled()
  })

  it('validates stored references at the shared creation path', async () => {
    const { app, drafter } = await makeApp()
    app.vudt.store.create(historical('malformed', { id: 'soft', version: 0 }))
    const response = await app.inject({ method: 'POST', url: '/tasks/malformed/retry' })
    expect(response.statusCode).toBe(400)
    expect(app.vudt.store.list()).toHaveLength(1)
    expect(drafter).not.toHaveBeenCalled()
  })

  it('still returns 503 for both creation and retry when the queue is full', async () => {
    const { app } = await makeApp(1)
    let release!: () => void
    let started!: () => void
    const entered = new Promise<void>(resolve => { started = resolve })
    app.vudt.queue.enqueue(async () => { started(); await new Promise<void>(resolve => { release = resolve }) })
    await entered
    try {
      const first = await app.inject({ method: 'POST', url: '/tasks', payload: { description: 'coffee', adminStyleId: 'soft' } })
      expect(first.statusCode).toBe(202)
      const full = await app.inject({ method: 'POST', url: '/tasks', payload: { description: 'coffee', adminStyleId: 'warm' } })
      expect(full.statusCode).toBe(503)
      const retry = await app.inject({ method: 'POST', url: `/tasks/${first.json().id}/retry` })
      expect(retry.statusCode).toBe(503)
      expect(app.vudt.store.list().filter(task => task.status === 'failed')).toHaveLength(2)
    } finally { release() }
  })

  it('copies the style reference when storing a task snapshot', () => {
    const store = new TaskStore()
    const reference = { id: 'soft' as const, version: 1 }
    store.create(historical('snapshot', reference))
    reference.version = 99
    expect(store.get('snapshot')).toHaveProperty('adminStyle', { id: 'soft', version: 1 })
  })
})
