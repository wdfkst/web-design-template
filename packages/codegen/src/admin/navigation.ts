import type { ProjectSpec } from '@vudt/spec'
import { pageComponentName } from '../naming.js'
import { adminLiteral } from './page.js'

export function renderAdminNavigation(spec: ProjectSpec): { router: string; navigation: string } {
  if (spec.experience?.kind !== 'admin') throw new Error('Admin experience required')
  const routes = spec.pages.map(page => {
    const meta = { title: page.title, chrome: page.pageType !== 'auth', ...((page.admin && 'returnRoute' in page.admin) ? { parentRoute: page.admin.returnRoute } : {}) }
    return `{ path: ${adminLiteral(page.route)}, component: () => import('./modules/${pageComponentName(page.route)}/index.vue'), meta: ${adminLiteral(meta)} }`
  })
  routes.push(`{ path: '/:pathMatch(.*)*', component: () => import('./pages/NotFoundPage.vue') }`)
  return {
    router: `import { createRouter, createWebHashHistory } from 'vue-router'\nexport const router = createRouter({ history: createWebHashHistory(), routes: [\n${routes.join(',\n')}\n] })\n`,
    navigation: `export const brand = ${adminLiteral(spec.meta.name)}\nexport const navigation = ${adminLiteral(spec.experience.navigation)}\n`,
  }
}
