import { describe, expect, it } from 'vitest'
import type { ProjectSpec } from '@vudt/spec'
import { footerNote, navLinks, pickShell, planLayout, topBarCta } from '../layouts.js'
import { landingSpec } from './fixture.js'

/** Replaces the page list while keeping a schema-valid spec around it. */
function withPages(spec: ProjectSpec, pages: ProjectSpec['pages']): ProjectSpec {
  return { ...spec, pages }
}

function page(
  route: string,
  title: string,
  pageType: ProjectSpec['pages'][number]['pageType'],
): ProjectSpec['pages'][number] {
  return { route, title, pageType, blocks: [], operations: [] }
}

describe('pickShell', () => {
  it('uses the top bar for a marketing site', () => {
    expect(pickShell(landingSpec())).toBe('AppShell')
  })

  for (const pageType of ['dashboard', 'settings', 'list-detail'] as const) {
    it(`uses the sidebar when a ${pageType} page is declared`, () => {
      const spec = withPages(landingSpec(), [
        page('/', 'Home', 'landing'),
        page('/console', 'Console', pageType),
      ])
      expect(pickShell(spec)).toBe('SidebarShell')
    })
  }

  // `form` pages (settings forms, admin forms) belong in the sidebar shell,
  // consistent with dashboard/settings. This pins the decision so a new page
  // type cannot drift to a shell unnoticed.
  it('sends a form page to the SidebarShell', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/contact', 'Contact', 'form'),
    ])
    expect(pickShell(spec)).toBe('SidebarShell')
  })
})

describe('navLinks', () => {
  it('lists every page in declaration order, labelled with its title', () => {
    expect(navLinks(landingSpec())).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
    ])
  })

  // The auth page is reached through the top-bar CTA instead; leaving it in the
  // nav as well would put a sign-in link in the middle of the menu.
  it('leaves auth pages out without disturbing the order of the rest', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/signin', 'Sign in', 'auth'),
      page('/pricing', 'Pricing', 'landing'),
    ])
    expect(navLinks(spec)).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
    ])
  })
})

describe('topBarCta', () => {
  it('names the first auth page so it stays reachable', () => {
    expect(topBarCta(landingSpec())).toEqual({ label: 'Sign in', to: '/signin' })
  })

  it('takes the first of several auth pages', () => {
    const spec = withPages(landingSpec(), [
      page('/', 'Home', 'landing'),
      page('/signin', 'Sign in', 'auth'),
      page('/signup', 'Sign up', 'auth'),
    ])
    expect(topBarCta(spec)).toEqual({ label: 'Sign in', to: '/signin' })
  })

  it('is undefined when the project declares no auth page', () => {
    expect(topBarCta(withPages(landingSpec(), [page('/', 'Home', 'landing')]))).toBeUndefined()
  })
})

describe('footerNote', () => {
  it('takes the first sentence of the description', () => {
    expect(footerNote(landingSpec())).toBe('A marketing landing page for a developer tooling product.')
  })

  it('truncates a first sentence that would run long in a footer', () => {
    const spec = {
      ...landingSpec(),
      meta: { ...landingSpec().meta, description: `${'x'.repeat(200)}.` },
    }
    const note = footerNote(spec)
    expect(note.endsWith('…')).toBe(true)
    expect(note.length).toBeLessThanOrEqual(141)
  })
})

describe('planLayout', () => {
  it('assembles the whole plan from the spec alone', () => {
    expect(planLayout(landingSpec())).toEqual({
      shell: 'AppShell',
      brand: 'Acme Landing',
      links: [
        { label: 'Home', to: '/' },
        { label: 'Pricing', to: '/pricing' },
      ],
      cta: { label: 'Sign in', to: '/signin' },
      note: 'A marketing landing page for a developer tooling product.',
    })
  })

  // `cta` is absent rather than undefined so the rendered App.vue can tell the
  // two cases apart without emitting a dead `const cta = undefined`.
  it('omits the cta key entirely when there is no auth page', () => {
    const spec = withPages(landingSpec(), [page('/', 'Home', 'landing')])
    expect(planLayout(spec)).not.toHaveProperty('cta')
  })
})
