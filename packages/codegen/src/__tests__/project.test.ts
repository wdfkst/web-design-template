import { describe, expect, it } from 'vitest'
import { assetFilePath } from '../naming.js'
import { generateProject } from '../project.js'
import { renderRouter } from '../router.js'
import { renderTokensCss } from '../tokens.js'
import { renderIndexHtml } from '../index-html.js'
import { dataModelSpec, landingSpec } from './fixture.js'

describe('generateProject', () => {
  it('emits one page file per spec page plus router and tokens', () => {
    const { files } = generateProject(landingSpec())
    expect(Object.keys(files).sort()).toEqual([
      'src/App.vue',
      'src/pages/HomePage.vue',
      'src/pages/PricingPage.vue',
      'src/pages/SigninPage.vue',
      'src/router.ts',
      'src/styles/tokens.css',
    ])
  })

  it('lists every manifest asset as an expected file under public/assets', () => {
    const spec = landingSpec()
    const { expectedAssets } = generateProject(spec)
    expect(expectedAssets).toHaveLength(spec.assets.length)
    for (const asset of spec.assets) {
      const expected = expectedAssets.find((e) => e.assetId === asset.id)!
      expect(expected.path).toBe(assetFilePath(asset.contentHash))
      expect(expected.transparent).toBe(asset.transparent)
    }
  })

  it('is deterministic: same spec in, byte-identical files out', () => {
    expect(generateProject(landingSpec())).toEqual(generateProject(landingSpec()))
  })

  it('emits data files only when the spec declares collections (zero-break)', () => {
    const withData = generateProject(dataModelSpec())
    expect(Object.keys(withData.files)).toContain('src/data/mock.ts')
    expect(Object.keys(withData.files)).toContain('src/data/store.ts')

    const withoutData = generateProject(landingSpec())
    expect(Object.keys(withoutData.files)).not.toContain('src/data/mock.ts')
    expect(Object.keys(withoutData.files)).not.toContain('src/data/store.ts')
  })
})

describe('renderRouter', () => {
  it('imports and registers one record per page', () => {
    const router = renderRouter(landingSpec())
    expect(router).toContain(`import HomePage from './pages/HomePage.vue'`)
    expect(router).toContain(`import PricingPage from './pages/PricingPage.vue'`)
    expect(router).toContain(`path: "/"`)
    expect(router).toContain(`name: "home"`)
    expect(router).toContain(`path: "/pricing"`)
    expect(router).toContain(`name: "pricing"`)
  })

  it('keeps hash history so the dist works in a file-served iframe', () => {
    expect(renderRouter(landingSpec())).toContain('createWebHashHistory()')
  })

  it('drops the shell chrome on auth routes', () => {
    const router = renderRouter(landingSpec())

    expect(router).toMatch(/path: "\/signin"[\s\S]*?meta: \{ chrome: false \}/)
    // The flag is per page, so it must not leak onto the marketing routes.
    expect(router).not.toMatch(/path: "\/"[\s\S]{0,90}chrome/)
  })
})

describe('renderTokensCss', () => {
  it('writes theme colors into CSS variables', () => {
    const css = renderTokensCss(landingSpec())
    expect(css).toContain('--color-primary: #4f46e5;')
    expect(css).toContain('--color-muted: #64748b;')
  })

  it('maps the radius and spacing enums to concrete values', () => {
    const spec = landingSpec()
    expect(renderTokensCss(spec)).toContain('--radius: 0.75rem;')
    expect(renderTokensCss(spec)).toContain('--space-unit: 1rem;')

    const compact = { ...spec, theme: { ...spec.theme, radius: 'full', spacing: 'compact' } } as const
    expect(renderTokensCss(compact)).toContain('--radius: 999px;')
    expect(renderTokensCss(compact)).toContain('--space-unit: 0.75rem;')
  })
})

describe('renderIndexHtml', () => {
  it('substitutes the project name placeholder', () => {
    const html = renderIndexHtml(landingSpec(), '<title>__PROJECT_NAME__</title>')
    expect(html).toBe('<title>Acme Landing</title>')
  })
})
