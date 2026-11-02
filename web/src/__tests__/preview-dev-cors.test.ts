// @vitest-environment node
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import config from '../../vite.config.js'

let root: string
let server: ViteDevServer
let base: string
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'preview-cors-'))
  await mkdir(join(root, 'public/admin-style-previews/soft-v1/assets'), { recursive: true })
  await writeFile(join(root, 'public/admin-style-previews/soft-v1/assets/app.js'), 'export const ready = true')
  await writeFile(join(root, 'public/ordinary.txt'), 'private scope')
  server = await createServer({ ...config, configFile: false, root, server: { ...config.server, port: 0, host: '127.0.0.1', proxy: {}, watch: null } })
  await server.listen()
  base = server.resolvedUrls!.local[0]!
})
afterAll(async () => { await server?.close(); if (root) await rm(root, { recursive: true, force: true }) })

it('allows opaque sandbox origins to read public preview modules', async () => {
  const response = await fetch(`${base}admin-style-previews/soft-v1/assets/app.js?v=1`, { headers: { Origin: 'null' } })
  expect(response.status).toBe(200)
  expect(response.headers.get('access-control-allow-origin')).toBe('*')
  expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  expect(await response.text()).toContain('export const ready = true')
})

it.each(['ordinary.txt', 'api/settings', 'admin-style-previews-other/file.js'])('does not grant opaque origins access outside previews: %s', async path => {
  const response = await fetch(`${base}${path}`, { headers: { Origin: 'null' } })
  expect(response.headers.get('access-control-allow-origin')).toBeNull()
  expect(response.headers.get('access-control-allow-credentials')).toBeNull()
})
