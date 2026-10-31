import { afterEach, expect, it, vi } from 'vitest'
import { createDemoSession } from '../auth/demo-session'

const scope = '/preview/project-a/'
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); vi.resetModules() })

it('accepts only the public demo credentials without clearing an existing session on error', () => {
  const session = createDemoSession(sessionStorage, scope)
  expect(session.isAuthenticated()).toBe(false)
  for (const [account, password] of [['', ''], ['demo', 'wrong'], ['other', 'demo123']]) {
    expect(session.signIn(account, password)).toBe(false)
    expect(session.isAuthenticated()).toBe(false)
  }
  expect(sessionStorage.length).toBe(0)
  expect(session.signIn('demo', 'demo123')).toBe(true)
  expect(session.isAuthenticated()).toBe(true)
  expect(session.signIn('demo', 'wrong')).toBe(false)
  expect(session.isAuthenticated()).toBe(true)
})

it('restores a session but never stores credentials and clears it on logout', () => {
  const session = createDemoSession(sessionStorage, scope)
  session.signIn('demo', 'demo123')
  const stored = sessionStorage.getItem(sessionStorage.key(0)!)!
  expect(JSON.parse(stored)).toEqual({ version: 1, authenticated: true })
  expect(stored).not.toContain('demo123')
  expect(createDemoSession(sessionStorage, scope).isAuthenticated()).toBe(true)
  session.signOut()
  expect(session.isAuthenticated()).toBe(false)
  expect(createDemoSession(sessionStorage, scope).isAuthenticated()).toBe(false)
})

it('isolates projects by deployment path', () => {
  createDemoSession(sessionStorage, scope).signIn('demo', 'demo123')
  expect(createDemoSession(sessionStorage, '/preview/project-b/').isAuthenticated()).toBe(false)
})

it.each(['broken', 'null', 'true', '{}', '{"version":2,"authenticated":true}', '{"version":1,"authenticated":"true"}'])('rejects malformed session data %s', value => {
  createDemoSession(sessionStorage, scope).signIn('demo', 'demo123')
  sessionStorage.setItem(sessionStorage.key(0)!, value)
  expect(createDemoSession(sessionStorage, scope).isAuthenticated()).toBe(false)
})

it('works in memory without storage', () => {
  const session = createDemoSession(undefined, scope)
  expect(session.signIn('demo', 'demo123')).toBe(true)
  expect(session.isAuthenticated()).toBe(true)
  session.signOut()
  expect(session.isAuthenticated()).toBe(false)
})

it.each(['getItem', 'setItem', 'removeItem'] as const)('survives storage %s failures', method => {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('blocked') })
  const session = createDemoSession(sessionStorage, scope)
  expect(session.isAuthenticated()).toBe(false)
  expect(session.signIn('demo', 'demo123')).toBe(true)
  expect(session.isAuthenticated()).toBe(true)
  session.signOut()
  expect(session.isAuthenticated()).toBe(false)
  if (method === 'removeItem') expect(createDemoSession(sessionStorage, scope).isAuthenticated()).toBe(false)
})

it('logs out in memory even when both storage writes and removals fail', () => {
  const session = createDemoSession(sessionStorage, scope)
  session.signIn('demo', 'demo123')
  for (const method of ['setItem', 'removeItem'] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('blocked') })
  }
  session.signOut()
  expect(session.isAuthenticated()).toBe(false)
})

it('lazily shares the runtime session and survives a denied sessionStorage getter', async () => {
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('denied') })
  const { getDemoSession } = await import('../auth/demo-session')
  const session = getDemoSession()
  expect(session.signIn('demo', 'demo123')).toBe(true)
  expect(getDemoSession().isAuthenticated()).toBe(true)
  getDemoSession().signOut()
  expect(session.isAuthenticated()).toBe(false)
  vi.restoreAllMocks()
})
