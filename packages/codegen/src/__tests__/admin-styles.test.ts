import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { writeProject } from '../write.js'
import { applyAdminStyle, finalizeSpec, ProjectSpecInputSchema } from '@vudt/spec'
import { generateAdminProject } from '../admin/project.js'
import { personalizedAdminFixtures } from './personalized-admin-fixtures.js'

const cases = [
  ['soft', 'icon-sidebar', 'welcome-grid', 'light', '#F8F4FF'],
  ['warm', 'expanded-sidebar', 'main-aside', 'light', '#F7F3E9'],
  ['mist', 'top-nav', 'sectioned', 'light', '#F1F5FA'],
  ['porcelain', 'wide-sidebar', 'staggered', 'light', '#F3F7FB'],
  ['aurora', 'top-nav-context', 'main-context', 'dark', '#141B2D'],
] as const
function exportsOf(source: string) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports: Record<string, unknown> = {}
  new Function('exports', output)(exports)
  return exports
}
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
describe('named admin style exports', () => {
  it.each(cases)('%s exports a project that typechecks and builds with the real template', async id => {
    const applied = applyAdminStyle(personalizedAdminFixtures.maintenance(), { id, version: 1 }, 42)
    if (!applied.ok) throw new Error(applied.feedback)
    const spec = finalizeSpec(ProjectSpecInputSchema.parse(applied.value))
    const target = await mkdtemp(join(tmpdir(), `vudt-style-${id}-`))
    const templateDir = resolve(__dirname, '../../../templates/vue3-base')
    try {
      await writeProject(spec, { templateDir, adminTemplateDir: resolve(templateDir, '../vue3-admin'), outDir: target, nodeModules: 'link' })
      for (const asset of generateAdminProject(spec).expectedAssets) {
        await writeFile(join(target, asset.path), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'))
      }
      for (const [binary, args] of [
        ['vue-tsc/bin/vue-tsc.js', ['--noEmit', '-p', join(target, 'tsconfig.json')]],
        ['vite/bin/vite.js', ['build', '--logLevel', 'warn']],
      ] as const) {
        const result = await promisify(execFile)('node', [resolve(target, 'node_modules', binary), ...args], { cwd: target })
          .then(() => ({ code: 0, output: '' })).catch(error => ({ code: error.code, output: `${error.stdout}\n${error.stderr}` }))
        expect(result, result.output).toMatchObject({ code: 0 })
      }
      expect(await readFile(join(target, 'dist/index.html'), 'utf8')).toContain(spec.meta.name)
    } finally { await rm(target, { recursive: true, force: true }) }
  }, 180_000)
  it.each(cases)('%s emits trusted layout, fixed mode and accessible theme colors', (id, shellVariant, workbenchLayout, mode, background) => {
    const applied = applyAdminStyle(personalizedAdminFixtures.maintenance(), { id, version: 1 }, 42)
    if (!applied.ok) throw new Error(applied.feedback)
    const spec = finalizeSpec(ProjectSpecInputSchema.parse(applied.value))
    const { files } = generateAdminProject(spec)
    const config = exportsOf(files['src/theme/presentation.ts']!)
    expect(config.adminStyle).toEqual({ id, version: 1 })
    expect(config.styleLayout).toEqual({ shellVariant, workbenchLayout, skin: id })
    expect(files['src/theme/tokens.ts']).toContain(JSON.stringify(mode))
    const css = files['src/theme/generated.css']!
    const value = (key: string) => css.match(new RegExp(`--admin-${key}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? ''
    expect(value('bg')).toBe(background)
    for (const surface of ['bg', 'surface']) {
      for (const text of ['text', 'muted', 'primary', 'error']) expect(contrast(value(text), value(surface))).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(value('on-primary'), value('primary'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(value('focus'), value('surface'))).toBeGreaterThanOrEqual(3)
    expect(spec.pages[0]!.admin).toEqual(personalizedAdminFixtures.maintenance().pages[0]!.admin)
  })
  it('keeps legacy presentation behavior with explicit null named-style exports', () => {
    const { files } = generateAdminProject(personalizedAdminFixtures.maintenance())
    const config = exportsOf(files['src/theme/presentation.ts']!)
    expect(config.adminStyle).toBeNull()
    expect(config.styleLayout).toBeNull()
    const experience = personalizedAdminFixtures.maintenance().experience
    expect(config.presentation).toEqual(experience?.kind === 'admin' ? experience.presentation : undefined)
  })
  it('rejects an unsupported reference instead of emitting a legacy project', () => {
    const spec = personalizedAdminFixtures.maintenance()
    expect(() => generateAdminProject({ ...spec, adminStyle: { id: 'soft', version: 999 } })).toThrow(/style|风格/i)
  })
})
