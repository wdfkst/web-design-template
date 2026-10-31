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
  const authRoutes = spec.pages.filter(page => page.pageType === 'auth').map(page => page.route)
  const protectedRoutes = spec.pages.filter(page => page.pageType !== 'auth').map(page => page.route)
  const auth = authRoutes.length ? { loginRoute: authRoutes[0]!, homeRoute: protectedRoutes[0] ?? null, protectedRoutes, authRoutes } : null
  const authImports = auth ? `import { auth } from './navigation'\nimport { getDemoSession } from './auth/demo-session'\nimport { installDemoGuard } from './auth/demo-router'\n` : ''
  const authGuard = auth ? 'if (auth) installDemoGuard(router, auth, getDemoSession())\n' : ''
  return {
    router: `import { createRouter, createWebHashHistory } from 'vue-router'\n${authImports}export const router = createRouter({ history: createWebHashHistory(), routes: [\n${routes.join(',\n')}\n] })\n${authGuard}`,
    navigation: `import type { DemoAuthConfig } from './auth/demo-session'\nexport const auth: DemoAuthConfig | null = ${adminLiteral(auth)}\nexport const brand = ${adminLiteral(spec.meta.name)}\nexport const navigation = ${adminLiteral(spec.experience.navigation)}\n`,
  }
}
