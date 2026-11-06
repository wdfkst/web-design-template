import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAdminStyle, finalizeSpec, ProjectSpecInputSchema } from '../../../packages/spec/src/index.js'
import { deriveSpecInput } from '../../../packages/templates/blocks/src/index.js'
import { createCoffeePreviewDraft, createCoffeePreviewRows } from '../fixture.js'
import { buildAdminStylePreviews, publishPreviewBuild } from '../build.js'
import { computeTemplateFingerprint, validatePreviewManifest } from '../manifest.js'

const ids = ['soft', 'warm', 'mist', 'porcelain', 'aurora'] as const
const dirs: string[] = []
async function temp() { const dir = await mkdtemp(join(tmpdir(), 'admin-previews-test-')); dirs.push(dir); return dir }
afterEach(async () => { vi.unstubAllGlobals(); for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
async function manifestFixture(dir: string) {
  const manifest = { schemaVersion: 1, templateFingerprint: await computeTemplateFingerprint(), styles: ids.map(id => ({ id, version: 1, entry: `${id}/1/index.html`, files: ['index.html'], assetKind: ['porcelain', 'aurora'].includes(id) ? 'illustration' : 'ai-sample' })) }
  for (const style of manifest.styles) { await mkdir(join(dir, style.id, '1'), { recursive: true }); await writeFile(join(dir, style.entry), '<!doctype html><title>preview</title>') }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest))
  return manifest
}

describe('coffee preview fixture', () => {
  it('uses deterministic coffee samples with numeric editable prices and formatted display prices', () => {
    const rows = createCoffeePreviewRows()
    expect(rows).toEqual(createCoffeePreviewRows())
    expect(rows.products).toHaveLength(6)
    expect(rows.orders).toHaveLength(24)
    expect(rows.products[0]).toMatchObject({ name: '燕麦拿铁', price: 32, displayPrice: '¥32.00', available: true })
    expect(rows.orders[0]).toMatchObject({ name: '林女士', drink: '燕麦拿铁', amount: 32 })
    expect(new Set(rows.orders.map(row => row.id)).size).toBe(24)
    expect(rows.products.every(row => row.price >= 18 && row.price <= 42)).toBe(true)
    rows.products[0]!.name = 'changed'
    expect(createCoffeePreviewRows().products[0]!.name).toBe('燕麦拿铁')
  })
  it('derives a deterministic complete admin project with usable routes and local illustration slots', () => {
    const draft = createCoffeePreviewDraft()
    expect(draft).toEqual(createCoffeePreviewDraft())
    const applied = applyAdminStyle(draft, { id: 'warm', version: 1 }, 42)
    if (!applied.ok) throw new Error(applied.feedback)
    const derived = deriveSpecInput(applied.value)
    if (!derived.ok) throw new Error(derived.feedback)
    const spec = finalizeSpec(ProjectSpecInputSchema.parse(derived.value))
    expect(spec.pages.map(page => page.route)).toEqual(['/', '/orders', '/products/edit', '/orders/detail'])
    expect(spec.pages.map(page => page.admin?.mode)).toEqual(['workbench', 'list', 'form', 'detail'])
    expect(spec.assets.length).toBeGreaterThan(0)
    expect(spec.collections?.map(collection => collection.id)).toEqual(['orders', 'products'])
    expect(spec.pages[0]?.title).toBe('咖啡工作台')
    expect(draft.pages[0]!.blocks[0]!.props.headline).toBe('订单与商品概览')
    expect(draft.pages[0]!.blocks[0]!.props.body).not.toContain('本地演示')
    expect(spec.pages[0]?.admin).toMatchObject({ modules: [{}, { fields: ['name', 'displayPrice'] }] })
  })
})

describe('preview manifest validation', () => {
  it('accepts the complete current set', async () => { const dir = await temp(); await manifestFixture(dir); await expect(validatePreviewManifest(dir)).resolves.toBeUndefined() })
  it.each(['missing-style', 'missing-file', 'version', 'fingerprint', 'absolute', 'traversal', 'backslash', 'duplicate', 'asset-kind'])('rejects %s without falling back', async fault => {
    const dir = await temp(), manifest = await manifestFixture(dir)
    if (fault === 'missing-style') manifest.styles.pop()
    if (fault === 'missing-file') await rm(join(dir, 'soft/1/index.html'))
    if (fault === 'version') manifest.styles[0]!.version = 999
    if (fault === 'fingerprint') manifest.templateFingerprint = '0'.repeat(64)
    if (fault === 'absolute') manifest.styles[0]!.entry = '/soft/1/index.html'
    if (fault === 'traversal') manifest.styles[0]!.entry = '../soft/1/index.html'
    if (fault === 'backslash') manifest.styles[0]!.entry = 'soft\\1\\index.html'
    if (fault === 'duplicate') manifest.styles[1] = manifest.styles[0]!
    if (fault === 'asset-kind') manifest.styles[3]!.assetKind = 'ai-sample'
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest))
    await expect(validatePreviewManifest(dir)).rejects.toThrow()
  })
  it('rejects missing local scripts and stylesheet images instead of accepting a broken entry', async () => {
    const dir = await temp(); await manifestFixture(dir)
    await writeFile(join(dir, 'soft/1/index.html'), '<script type="module" src="./assets/app.js"></script>')
    await expect(validatePreviewManifest(dir)).rejects.toThrow()
    await mkdir(join(dir, 'soft/1/assets'))
    await writeFile(join(dir, 'soft/1/assets/app.js'), 'export {}')
    await writeFile(join(dir, 'soft/1/index.html'), '<link rel="stylesheet" href="./assets/app.css">')
    await writeFile(join(dir, 'soft/1/assets/app.css'), '.image { background: url(./missing.png) }')
    await expect(validatePreviewManifest(dir)).rejects.toThrow()
  })
  it('hashes relative names and contents, not root location or timestamps', async () => {
    const a = await temp(), b = await temp()
    for (const dir of [a, b]) { await mkdir(join(dir, 'src')); await writeFile(join(dir, 'src/a.ts'), 'first'); await writeFile(join(dir, 'src/b.ts'), 'second') }
    expect(await computeTemplateFingerprint(a, ['src'])).toBe(await computeTemplateFingerprint(b, ['src']))
    const before = await computeTemplateFingerprint(a, ['src'])
    await writeFile(join(a, 'src/b.ts'), 'changed')
    expect(await computeTemplateFingerprint(a, ['src'])).not.toBe(before)
  })
})

describe('atomic preview publication', () => {
  it('keeps a previous successful artifact when the build fails halfway', async () => {
    const dir = join(await temp(), 'previews')
    await mkdir(dir); await writeFile(join(dir, 'keep.txt'), 'previous successful build')
    await expect(publishPreviewBuild(dir, async staging => { await writeFile(join(staging, 'partial'), 'partial'); throw new Error('build failed') })).rejects.toThrow('build failed')
    expect(await readFile(join(dir, 'keep.txt'), 'utf8')).toBe('previous successful build')
  })
  it('replaces a previous artifact only after all five entries validate, leaving siblings untouched', async () => {
    const parent = await temp(), dir = join(parent, 'previews')
    await mkdir(dir); await writeFile(join(dir, 'old.txt'), 'previous')
    await writeFile(join(parent, 'unrelated.txt'), 'other web resource')
    await publishPreviewBuild(dir, async staging => { await manifestFixture(staging) })
    await validatePreviewManifest(dir)
    await expect(readFile(join(dir, 'old.txt'))).rejects.toThrow()
    expect(await readFile(join(parent, 'unrelated.txt'), 'utf8')).toBe('other web resource')
  })
  it('does not replace existing artifacts with an invalid completed build', async () => {
    const dir = join(await temp(), 'previews')
    await mkdir(dir); await writeFile(join(dir, 'keep.txt'), 'previous')
    await expect(publishPreviewBuild(dir, async () => {})).rejects.toThrow()
    expect(await readFile(join(dir, 'keep.txt'), 'utf8')).toBe('previous')
  })
  it('publishes all five real typechecked projects without network calls', async () => {
    let requests = 0
    vi.stubGlobal('fetch', () => { requests++; throw new Error('Network forbidden in preview build') })
    const dir = join(await temp(), 'previews')
    await buildAdminStylePreviews(dir)
    await validatePreviewManifest(dir)
    for (const id of ids) {
      const html = await readFile(join(dir, id, '1/index.html'), 'utf8')
      expect(html).toContain('./assets/')
      expect(html).not.toMatch(/(?:src|href)="https?:/)
    }
    expect(requests).toBe(0)
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
    const files: string[] = manifest.styles[0].files ?? []
    const image = files.find(file => file.endsWith('.png'))
    expect(image, 'manifest must track the actual local illustration').toBeDefined()
    await rm(join(dir, 'soft/1', image!))
    await expect(validatePreviewManifest(dir)).rejects.toThrow()
  }, 600_000)
})
