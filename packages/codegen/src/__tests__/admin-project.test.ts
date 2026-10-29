import { expect, it } from 'vitest'
import { landingSpec } from './fixture.js'
import { generateProject } from '../project.js'

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
it('rejects normalized module collisions', () => {
  const spec = fixture()
  spec.pages = [{ ...spec.pages[0]!, route: '/a-b' }, { ...spec.pages[0]!, route: '/a/b' }]
  expect(() => generateProject(spec)).toThrow(/collision/i)
})
