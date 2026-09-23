import { describe, expect, it } from 'vitest'
import type { ProjectSpec } from '@vudt/spec'
import { renderApp } from '../app.js'
import { landingSpec } from './fixture.js'

function withPages(spec: ProjectSpec, pages: ProjectSpec['pages']): ProjectSpec {
  return { ...spec, pages }
}

function page(
  route: string,
  title: string,
  pageType: ProjectSpec['pages'][number]['pageType'],
): ProjectSpec['pages'][number] {
  return { route, title, pageType, blocks: [] }
}

describe('renderApp', () => {
  it('selects the shell the layout plan asked for', () => {
    const sfc = renderApp(landingSpec())

    expect(sfc).toContain(`import AppShell from './layouts/AppShell.vue'`)
    expect(sfc).toContain('<AppShell')
    expect(sfc).toContain('<RouterView />')
  })

  it('writes the brand, the nav entries and the cta as script consts', () => {
    const sfc = renderApp(landingSpec())

    expect(sfc).toContain('const brand = "Acme Landing"')
    expect(sfc).toContain('{ label: "Home", to: "/" }')
    expect(sfc).toContain('{ label: "Pricing", to: "/pricing" }')
    expect(sfc).toContain('const cta = { label: "Sign in", to: "/signin" }')
    // Every destination is a declared route, so no link can dangle.
    expect(sfc).toContain(':links="links"')
  })

  it('passes a chromeless flag so auth pages can drop the shell chrome', () => {
    const sfc = renderApp(landingSpec())

    expect(sfc).toContain(`import { computed } from 'vue'`)
    expect(sfc).toContain(`import { useRoute } from 'vue-router'`)
    expect(sfc).toContain('route.meta.chrome === false')
    expect(sfc).toContain(':chromeless="chromeless"')
  })

  it('renders the sidebar shell without the footer note', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/console', 'Console', 'dashboard'),
    ])
    const sfc = renderApp(spec)

    expect(sfc).toContain(`import SidebarShell from './layouts/SidebarShell.vue'`)
    expect(sfc).not.toContain('const note')
  })

  // Dropping the cta on the sidebar branch would reopen the hole the top-bar cta
  // exists to close: an auth page is in no nav entry, so the button is its only
  // way in — and the sidebar has one too.
  it('still passes the auth cta to the sidebar shell', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/console', 'Console', 'dashboard'),
      page('/signin', 'Sign in', 'auth'),
    ])
    const sfc = renderApp(spec)

    expect(sfc).toContain(`import SidebarShell from './layouts/SidebarShell.vue'`)
    expect(sfc).toContain('const cta = { label: "Sign in", to: "/signin" }')
    expect(sfc).toContain(':cta="cta"')
    expect(sfc).not.toContain('const note')
  })

  // `planLayout` omits the cta key rather than setting it to undefined so this
  // branch can tell the two cases apart; emitting `const cta = undefined` next to
  // `:cta="cta"` hands the shell a dead prop it cannot distinguish from a real one,
  // and defeats exactly that.
  it('emits no cta const at all when an AppShell project has no auth page', () => {
    const spec = withPages(landingSpec(), [page('/', 'Home', 'landing')])
    const sfc = renderApp(spec)

    expect(sfc).toContain(`import AppShell from './layouts/AppShell.vue'`)
    expect(sfc).not.toContain('const cta')
    expect(sfc).not.toContain(':cta=')
    expect(sfc).toContain('const note = ')
  })

  it('is deterministic: same spec in, byte-identical output out', () => {
    expect(renderApp(landingSpec())).toBe(renderApp(landingSpec()))
  })
})
