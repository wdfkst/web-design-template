import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { writeProject } from '../write.js'
import { landingSpec } from './fixture.js'

const run = promisify(execFile)
const templateDir = resolve(__dirname, '../../../templates/vue3-base')
const adminTemplateDir = resolve(templateDir, '../vue3-admin')

it.each(['signin', 'no-auth', 'auth-only'] as const)('builds an independent %s admin export', async kind => {
  const spec = landingSpec()
  const authPage = spec.pages.find(page => page.pageType === 'auth')!
  const home = { ...spec.pages[0]!, route: '/workspace', blocks: [], admin: { mode: 'workbench' as const, collections: [], shortcuts: [] } }
  spec.experience = { kind: 'admin', navigation: kind === 'auth-only' ? [] : [{ id: 'workspace', label: '工作台', route: '/workspace' }] }
  spec.pages = kind === 'signin' ? [authPage, home] : kind === 'auth-only' ? [authPage] : [home]
  if (kind === 'no-auth') spec.assets = []
  const outDir = await mkdtemp(join(tmpdir(), `admin-auth-${kind}-`))
  try {
    await writeProject(spec, { templateDir, adminTemplateDir, outDir, nodeModules: 'link' })
    const pkg = JSON.parse(await readFile(join(outDir, 'package.json'), 'utf8'))
    expect(pkg.dependencies['@ant-design/icons-vue']).toBe('7.0.1')
    for (const [binary, args] of [
      ['vue-tsc/bin/vue-tsc.js', ['--noEmit', '-p', join(outDir, 'tsconfig.json')]],
      ['vite/bin/vite.js', ['build', '--logLevel', 'warn']],
    ] as const) {
      const result = await run('node', [resolve(outDir, 'node_modules', binary), ...args], { cwd: outDir })
        .then(() => ({ code: 0, output: '' }))
        .catch(error => ({ code: error.code, output: `${error.stdout}\n${error.stderr}` }))
      expect(result, result.output).toMatchObject({ code: 0 })
    }
    expect(await readFile(join(outDir, 'dist/index.html'), 'utf8')).toContain('type="module"')
  } finally { await rm(outDir, { recursive: true, force: true }) }
}, 180_000)
