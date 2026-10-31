export interface DemoAuthConfig {
  loginRoute: string
  homeRoute: string | null
  protectedRoutes: string[]
  authRoutes: string[]
}

export interface DemoSession {
  isAuthenticated(): boolean
  signIn(account: string, password: string): boolean
  signOut(): void
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// This flag only drives a demo UI; it is not an authentication credential.
export function createDemoSession(storage: SessionStorage | undefined, scope: string): DemoSession {
  const key = `vudt:demo-auth:v1:${scope}`
  let authenticated = false
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null')
    authenticated = saved?.version === 1 && saved?.authenticated === true
  } catch { /* Storage may be unavailable or contain malformed data. */ }

  return {
    isAuthenticated: () => authenticated,
    signIn(account, password) {
      if (account !== 'demo' || password !== 'demo123') return false
      authenticated = true
      try { storage?.setItem(key, JSON.stringify({ version: 1, authenticated: true })) } catch { /* Keep the in-memory session. */ }
      return true
    },
    signOut() {
      authenticated = false
      try { storage?.removeItem(key) } catch {
        try { storage?.setItem(key, JSON.stringify({ version: 1, authenticated: false })) } catch { /* In-memory logout still succeeds. */ }
      }
    },
  }
}

let session: DemoSession | undefined

export function getDemoSession(): DemoSession {
  if (!session) {
    let storage: SessionStorage | undefined
    try { storage = window.sessionStorage } catch { /* Private or restricted browsing. */ }
    session = createDemoSession(storage, window.location.pathname)
  }
  return session
}
