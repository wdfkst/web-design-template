import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createDemoSession, type DemoAuthConfig } from '../auth/demo-session'
import { installDemoGuard, resolveDemoTarget } from '../auth/demo-router'

const config: DemoAuthConfig = {
  loginRoute: '/signin', homeRoute: '/workspace',
  protectedRoutes: ['/workspace', '/items'], authRoutes: ['/signin', '/register'],
}
function setup(auth = config) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    ...[...auth.protectedRoutes, ...auth.authRoutes].map(path => ({ path, component: {} })),
    { path: '/:pathMatch(.*)*', name: 'not-found', component: {} },
  ] })
  const session = createDemoSession(undefined, 'router-test')
  installDemoGuard(router, auth, session)
  return { router, session }
}

describe('demo route guard', () => {
  it('redirects a protected deep link to the actual login with its query and hash', async () => {
    const { router } = setup()
    await router.push('/items?tab=recent#row')
    expect(router.currentRoute.value.path).toBe('/signin')
    expect(router.currentRoute.value.query.returnTo).toBe('/items?tab=recent#row')
  })
  it.each(['/ITEMS', '/items/'])('protects equivalent router matches %s', async path => {
    const { router } = setup()
    await router.push(path)
    expect(router.currentRoute.value.path).toBe('/signin')
    expect(router.currentRoute.value.query.returnTo).toBe(path)
  })
  it('allows authenticated access and redirects every auth page to a valid return target', async () => {
    const { router, session } = setup()
    session.signIn('demo', 'demo123')
    await router.push('/items?tab=recent#row')
    expect(router.currentRoute.value.fullPath).toBe('/items?tab=recent#row')
    await router.push({ path: '/register', query: { returnTo: '/items?tab=old#row' } })
    expect(router.currentRoute.value.fullPath).toBe('/items?tab=old#row')
    await router.push('/signin?returnTo=https://example.com')
    expect(router.currentRoute.value.path).toBe('/workspace')
  })
  it('keeps other auth pages public and unknown routes as 404', async () => {
    const { router } = setup()
    await router.push('/register')
    expect(router.currentRoute.value.path).toBe('/register')
    await router.push('/missing')
    expect(router.currentRoute.value.name).toBe('not-found')
  })
  it('does not redirect auth-only projects even after signing in', async () => {
    const auth = { ...config, homeRoute: null, protectedRoutes: [] }
    const { router, session } = setup(auth)
    await router.push('/signin')
    session.signIn('demo', 'demo123')
    await router.push('/register')
    expect(router.currentRoute.value.path).toBe('/register')
    expect(resolveDemoTarget(router, auth, '/workspace')).toBeNull()
  })
})

describe('demo return target', () => {
  it('preserves internal query/hash', () => {
    const { router } = setup()
    expect(resolveDemoTarget(router, config, '/items?next=https://example.com#row')).toBe('/items?next=https://example.com#row')
  })
  it.each([undefined, null, 12, {}, ['/items'], '', 'items', '//example.com/items',
    'https://example.com/items', 'javascript:alert(1)', '/\\example.com', '/items\\x',
    '/missing', '/signin', '/register?returnTo=/items', '/items/../signin',
  ])('falls back to the actual home for invalid candidate %j', candidate => {
    const { router } = setup()
    expect(resolveDemoTarget(router, config, candidate)).toBe('/workspace')
  })
})
