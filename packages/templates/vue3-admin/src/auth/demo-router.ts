import type { Router } from 'vue-router'
import type { DemoAuthConfig, DemoSession } from './demo-session'

export function resolveDemoTarget(router: Router, config: DemoAuthConfig, candidate: unknown): string | null {
  if (typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    const target = router.resolve(candidate)
    if (config.protectedRoutes.includes(target.path) && !config.authRoutes.includes(target.path)) return target.fullPath
  }
  return config.homeRoute
}

export function installDemoGuard(router: Router, config: DemoAuthConfig, session: DemoSession): void {
  router.beforeEach(to => {
    if (to.matched.some(record => config.protectedRoutes.includes(record.path)) && !session.isAuthenticated()) {
      return { path: config.loginRoute, query: { returnTo: to.fullPath } }
    }
    if (to.matched.some(record => config.authRoutes.includes(record.path)) && session.isAuthenticated()) {
      const target = resolveDemoTarget(router, config, to.query.returnTo)
      if (target) return target
    }
  })
}
