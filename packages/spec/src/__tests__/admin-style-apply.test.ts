import { describe, expect, it } from 'vitest'
import * as spec from '../index.js'
import { validSpecInput } from './fixture.js'

function adminInput() {
  return {
    ...validSpecInput(),
    experience: { kind: 'admin' as const, navigation: [{ id: 'home', label: '首页', route: '/' }] },
    collections: [{ id: 'items', label: '商品', model: { name: { type: 'string' as const, label: '名称' } }, fields: ['name'], seed: 8, actions: [] }],
    pages: [{ route: '/', title: '首页', pageType: 'dashboard', blocks: [], operations: [], admin: { mode: 'workbench', collections: ['items'], shortcuts: [] } }],
  }
}

function applied(raw: unknown = adminInput(), seed = 42) {
  const result = spec.applyAdminStyle(raw, { id: 'soft', version: 1 }, seed)
  if (!result.ok) throw new Error(result.feedback)
  return result.value as ReturnType<typeof adminInput> & { adminStyle: spec.AdminStyleReference }
}

describe('applyAdminStyle', () => {
  it('replaces controlled visuals while preserving business content and the original input', () => {
    const raw = adminInput()
    const before = structuredClone(raw)
    const value = applied(raw)
    expect(value.theme).toEqual(spec.resolveAdminStyle({ id: 'soft', version: 1 })!.theme)
    expect(value.experience).toEqual({ ...raw.experience, presentation: { appearance: 'jelly', decoration: 'balanced', density: 'comfortable', shell: 'sidebar' } })
    expect(value.styleBible).toEqual({ artStyle: '3d-clay', lineWeight: 'none', shading: 'soft-gradient', perspective: 'three-quarter', palette: ['#7550B5', '#9C6A36', '#D19643'], backgroundTreatment: 'subtle-gradient', negativePrompt: 'text, watermark, user interface screenshot', seed: 1234, material: 'soft-clay' })
    expect(value.adminStyle).toEqual({ id: 'soft', version: 1 })
    for (const key of ['pages', 'collections', 'forms', 'assets', 'meta'] as const) expect(value[key]).toEqual(before[key])
    expect(raw).toEqual(before)
  })

  it.each([null, [], 'bad json', 1, {}, validSpecInput(), { ...validSpecInput(), experience: { kind: 'marketing' } }])('rejects malformed or non-admin input: %j', raw => {
    const result = spec.applyAdminStyle(raw, { id: 'soft', version: 1 }, 42)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.feedback.length).toBeGreaterThan(0)
  })

  it.each([0, 17])('preserves valid seed %s', seed => {
    expect(applied({ ...adminInput(), styleBible: { seed } }).styleBible.seed).toBe(seed)
  })

  it.each([undefined, -1, 1.5, '7', null, NaN, Infinity])('replaces invalid seed %s with the supplied stable seed', seed => {
    expect(applied({ ...adminInput(), styleBible: { seed } }).styleBible.seed).toBe(42)
  })

  it('handles a missing style bible and rejects unsupported references', () => {
    expect(applied({ ...adminInput(), styleBible: undefined }).styleBible.seed).toBe(42)
    expect(spec.applyAdminStyle(adminInput(), { id: 'soft', version: 999 }, 42).ok).toBe(false)
  })

  it('overrides a model-provided reference without repairing invalid business data', () => {
    const value = applied({ ...adminInput(), adminStyle: { id: 'aurora', version: 99 }, pages: null })
    expect(value.adminStyle).toEqual({ id: 'soft', version: 1 })
    expect(value.pages).toBeNull()
    expect(spec.ProjectSpecInputSchema.safeParse(value).success).toBe(false)
  })
})

describe('named style spec integrity', () => {
  it.each(spec.ADMIN_STYLE_IDS)('accepts the controlled %s definition and retains its material', id => {
    const result = spec.applyAdminStyle(adminInput(), { id, version: 1 }, 42)
    if (!result.ok) throw new Error(result.feedback)
    const parsed = spec.ProjectSpecInputSchema.parse(result.value)
    expect(parsed.adminStyle).toEqual({ id, version: 1 })
    expect(parsed.styleBible.material).toBe(spec.resolveAdminStyle({ id, version: 1 })!.material)
    expect(spec.ProjectSpecSchema.safeParse(spec.finalizeSpec(parsed)).success).toBe(true)
  })

  it.each(['theme', 'presentation', 'styleBible', 'palette', 'material', 'version', 'experience'] as const)('rejects forged %s on both input and finalized specs', field => {
    const value = applied() as any
    if (field === 'theme') value.theme.radius = 'sm'
    if (field === 'presentation') value.experience.presentation.shell = 'topbar'
    if (field === 'styleBible') value.styleBible.artStyle = 'flat-vector'
    if (field === 'palette') value.styleBible.palette = ['#000000', '#ffffff']
    if (field === 'material') delete value.styleBible.material
    if (field === 'version') value.adminStyle.version = 999
    if (field === 'experience') Object.assign(value, validSpecInput(), { experience: { kind: 'marketing' } })
    const expectedPath = ({ theme: 'theme', presentation: 'experience.presentation', styleBible: 'styleBible', palette: 'styleBible', material: 'styleBible', version: 'adminStyle', experience: 'experience' } as const)[field]
    for (const result of [
      spec.ProjectSpecInputSchema.safeParse(value),
      spec.ProjectSpecSchema.safeParse({ ...value, assets: value.assets.map((asset: spec.AssetInput) => ({ ...asset, contentHash: '0123456789abcdef' })) }),
    ]) {
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues.map(issue => issue.path.join('.'))).toContain(expectedPath)
    }
  })

  it('keeps legacy specs compatible and rejects unknown material', () => {
    expect(spec.ProjectSpecInputSchema.safeParse(validSpecInput()).success).toBe(true)
    expect(spec.StyleBibleSchema.safeParse({ ...validSpecInput().styleBible, material: 'unknown' }).success).toBe(false)
  })
})
