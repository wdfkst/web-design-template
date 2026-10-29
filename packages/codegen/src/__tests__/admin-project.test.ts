import { expect, it } from 'vitest'
import { FormSchema } from '@vudt/spec'
import { personalizedAdminFixtures } from './personalized-admin-fixtures.js'
import { landingSpec } from './fixture.js'
import { generateProject } from '../project.js'
import { adminPageProps } from '../admin/page.js'
it.each([false, true])('classifies welcome and empty panels independently of block order %s', reverse => {
  const spec = fixture()
  const blocks = [{ component: 'AdminWelcomePanel', props: { headline: '欢迎' }, assetBindings: {} }, { component: 'EmptyStatePanel', props: { headline: '暂无' }, assetBindings: {} }]
  spec.pages[0]!.blocks = reverse ? blocks.reverse() : blocks
  expect(adminPageProps(spec, spec.pages[0]!)).toMatchObject({ welcomePanel: { headline: '欢迎' }, emptyPanel: { headline: '暂无' } })
})

function fixture() {
  const spec = landingSpec()
  spec.experience = { kind: 'admin', navigation: [{ id: 'home', label: '工作台', route: '/' }] }
  spec.pages = [{ ...spec.pages[0]!, route: '/', title: '</script><script>alert(1)</script>', blocks: [], admin: { mode: 'workbench', collections: [], shortcuts: [] } }]
  spec.assets = []
  return spec
}
it('dispatches admin to lazy modules and hash routing without interpolating titles into templates', () => {
  const result = generateProject(fixture())
  expect(result.files['src/modules/HomePage/index.vue']).toContain('v-bind="pageProps"')
  expect(result.files['src/modules/HomePage/config.ts']).toContain('\\u003c/script>')
  expect(result.files['src/router.ts']).toContain('createWebHashHistory')
  expect(result.files['src/router.ts']).toContain("import('./modules/HomePage/index.vue')")
  expect(result.files['src/router.ts']).toContain(':pathMatch(.*)*')
  expect(result.files['src/navigation.ts']).toContain('工作台')
  expect(result.files['src/pages/HomePage.vue']).toBeUndefined()
})
it('renders admin auth assets using sidecar dimensions without legacy block imports', () => {
  const spec = landingSpec()
  spec.experience = { kind: 'admin', navigation: [] }
  const auth = spec.pages.find(page => page.pageType === 'auth')!
  spec.pages = [auth]
  const result = generateProject(spec)
  const source = Object.entries(result.files).find(([path]) => path.endsWith('/index.vue'))![1]
  expect(source).toContain('AdminAuthPage')
  expect(source).not.toContain("../blocks/")
  expect(result.files['src/modules/SigninPage/config.ts']).toContain('512')
})
it('documents actual page paths and form ids for customization', () => {
  const spec = fixture()
  spec.pages[0]!.route = '/asset-library'
  spec.forms = [FormSchema.parse({ id: 'asset-editor', label: '素材编辑', fields: [{ key: 'name', label: '名称', type: 'string' }] })]
  const readme = generateProject(spec).files['README.md']!
  expect(readme).toContain('/asset-library')
  expect(readme).toContain('src/modules/AssetLibraryPage/config.ts')
  expect(readme).toContain('asset-editor')
  expect(readme).toContain('src/theme/presentation.ts')
  expect(readme).toContain('src/data/repository.ts')
  expect(readme).toContain('刷新后重置')
})
it.each(['maintenance', 'media', 'registration'] as const)('preserves personalized configuration for %s', name => {
  const spec = personalizedAdminFixtures[name]()
  const files = generateProject(spec).files
  const configs = Object.entries(files).filter(([path]) => path.endsWith('/config.ts')).map(([, content]) => content).join('\n')
  expect(configs).toContain(name === 'media' ? 'cards' : 'table')
  if (name === 'maintenance') {
    expect(configs).toContain('grouped')
    expect(configs).toContain('focus')
  }
  if (name === 'media') {
    expect(configs).toContain('aside')
    expect(configs).toContain('overview')
  }
  expect(configs).toContain('\\u003c/script>')
  expect(configs).not.toContain('</script>')
  expect(files['README.md']).toContain(`/${name}`)
  expect(files['README.md']).toContain(`${name}-form`)
  expect(files['src/theme/presentation.ts']).toContain(name === 'registration' ? 'minimal' : 'balanced')
})
it('rejects normalized module collisions', () => {
  const spec = fixture()
  spec.pages = [{ ...spec.pages[0]!, route: '/a-b' }, { ...spec.pages[0]!, route: '/a/b' }]
  expect(() => generateProject(spec)).toThrow(/collision/i)
})
