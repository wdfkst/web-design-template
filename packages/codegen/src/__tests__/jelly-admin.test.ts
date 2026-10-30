import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { generateProject } from '../project.js'
import { writeProject } from '../write.js'
import { jellyAdminSpec, jellyCoverSvg } from './jelly-admin-fixtures.js'

const run = promisify(execFile)
const templateDir = resolve(__dirname, '../../../templates/vue3-base')
const adminTemplateDir = resolve(templateDir, '../vue3-admin')
it.each(['maintenance', 'media', 'registration'] as const)('builds a standalone jelly %s project', async name => {
  const spec = jellyAdminSpec(name)
  const project = generateProject(spec)
  const outDir = await mkdtemp(join(tmpdir(), `jelly-${name}-`))
  try {
    await writeProject(spec, { templateDir, adminTemplateDir, outDir, nodeModules: 'link' })
    await mkdir(join(outDir, 'public/covers'), { recursive: true })
    await writeFile(join(outDir, 'public/covers/sample.svg'), jellyCoverSvg)
    const configs = Object.entries(project.files).filter(([path]) => path.endsWith('/config.ts')).map(([, value]) => value).join('\n')
    expect(project.files['src/theme/presentation.ts']).toContain('jelly')
    expect(project.files['src/theme/presentation.ts']).toContain(name === 'maintenance' ? 'toolkit' : name === 'media' ? 'bloom' : 'spark')
    if (name === 'media') expect(configs).toContain('"coverField":"cover"')
    expect(Object.values(project.files).join('\n')).not.toContain('@vudt/')
    for (const asset of project.expectedAssets) expect(configs).toContain(asset.path.replace(/^public/, ''))
    const readme = await readFile(join(outDir, 'README.md'), 'utf8')
    for (const entry of ['public/covers', './covers/sample.png', 'CSP', 'no-referrer', '不自动下载']) expect(readme).toContain(entry)
    for (const [binary, args] of [['vue-tsc/bin/vue-tsc.js', ['--noEmit', '-p', join(outDir, 'tsconfig.json')]], ['vite/bin/vite.js', ['build', '--logLevel', 'warn']]] as const) {
      const result = await run('node', [resolve(outDir, 'node_modules', binary), ...args], { cwd: outDir }).then(() => ({ code: 0, output: '' })).catch(error => ({ code: error.code, output: `${error.stdout}\n${error.stderr}` }))
      expect(result, result.output).toMatchObject({ code: 0 })
    }
    expect(await readFile(join(outDir, 'dist/covers/sample.svg'), 'utf8')).toBe(jellyCoverSvg)
  } finally { await rm(outDir, { recursive: true, force: true }) }
}, 180_000)
it('supports orbit and minimal without forcing welcome assets', () => {
  const spec = jellyAdminSpec('media', 'orbit', true)
  expect(spec.assets).toHaveLength(0)
  expect(generateProject(spec).files['src/theme/presentation.ts']).toContain('orbit')
  expect(spec.experience).toHaveProperty('presentation.decoration', 'minimal')
})
