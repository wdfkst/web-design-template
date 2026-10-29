import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { generateProject } from '../project.js'
import { writeProject } from '../write.js'
import { personalizedAdminFixtures } from './personalized-admin-fixtures.js'

const run = promisify(execFile)
const templateDir = resolve(__dirname, '../../../templates/vue3-base')
const adminTemplateDir = resolve(templateDir, '../vue3-admin')
// Local one-pixel PNG fixture, not model-generated artwork.
const fixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')

it.each(['maintenance', 'media', 'registration'] as const)('exports a compilable personalized %s project', async name => {
  const spec = personalizedAdminFixtures[name]()
  const generated = generateProject(spec)
  const target = await mkdtemp(join(tmpdir(), `vudt-${name}-`))
  try {
    await writeProject(spec, { templateDir, adminTemplateDir, outDir: target, nodeModules: 'link' })
    const configs = Object.entries(generated.files).filter(([path]) => path.endsWith('/config.ts')).map(([, source]) => source).join('\n')
    expect(configs).toContain('modules')
    expect(configs).toContain(name === 'media' ? 'cards' : 'table')
    for (const asset of generated.expectedAssets) {
      expect(configs).toContain(asset.path.replace(/^public/, ''))
      await writeFile(join(target, asset.path), fixturePng)
      expect(await readFile(join(target, asset.path))).toEqual(fixturePng)
    }
    for (const [binary, args] of [
      ['vue-tsc/bin/vue-tsc.js', ['--noEmit', '-p', join(target, 'tsconfig.json')]],
      ['vite/bin/vite.js', ['build', '--logLevel', 'warn']],
    ] as const) {
      const result = await run('node', [resolve(target, 'node_modules', binary), ...args], { cwd: target })
        .then(() => ({ exitCode: 0, output: '' }))
        .catch(error => ({ exitCode: error.code, output: `${error.stdout}\n${error.stderr}` }))
      expect(result, result.output).toMatchObject({ exitCode: 0 })
    }
    expect(await readFile(join(target, 'dist/index.html'), 'utf8')).toContain(spec.meta.name)
  } finally {
    await rm(target, { recursive: true, force: true })
  }
}, 180_000)
