import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { buildApp } from '../app.js'
import { landingDraft } from './fixture.js'

it('runs an admin task through HTTP, preview, and both ZIP exports', async () => {
  const base = landingDraft() as Record<string, unknown>
  const draft = { ...base, collections: [{ id: 'items', label: '记录', model: { id: { type: 'number', label: '编号' } }, fields: ['id'], seed: 3, actions: [] }], forms: [], experience: { kind: 'admin', navigation: [{ id: 'home', label: '首页', route: '/' }] }, pages: ['/', '/two', '/three'].map(route => ({ route, title: '工作台', pageType: 'dashboard', blocks: [], admin: { mode: 'workbench', collections: ['items'], shortcuts: [] } })) }
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'admin-http-'))
  const app = buildApp({ workspaceRoot, templateDir: resolve(__dirname, '../../../packages/templates/vue3-base'), adminTemplateDir: resolve(__dirname, '../../../packages/templates/vue3-admin'), drafter: () => ({ name: 'fixture', async draft() { return draft } }), provider: () => ({ name: 'unused', async generate() { throw new Error('Unexpected image request') } }) })
  try {
    const response = await app.inject({ method: 'POST', url: '/tasks', payload: { description: '后台测试' } })
    expect(response.statusCode).toBe(202)
    const { id } = response.json()
    await app.vudt.queue.drain()
    const task = (await app.inject({ method: 'GET', url: `/tasks/${id}` })).json()
    expect(task.status, JSON.stringify(task.error)).toBe('ready')
    expect((await app.inject({ method: 'GET', url: `/preview/${id}/` })).statusCode).toBe(200)
    for (const kind of ['source', 'dist']) {
      const zip = await app.inject({ method: 'GET', url: `/tasks/${id}/export/${kind}` })
      expect(zip.statusCode).toBe(200)
      expect(zip.rawPayload.subarray(0, 2).toString()).toBe('PK')
    }
  } finally { await app.vudt.queue.drain(); await app.close(); await rm(workspaceRoot, { recursive: true, force: true }) }
}, 180_000)
