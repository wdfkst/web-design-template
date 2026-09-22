import type { ProjectSpec } from '@vudt/spec'

/** The layout component a project renders once around every page. */
export type ShellName = 'AppShell' | 'SidebarShell'

export interface NavLink {
  label: string
  to: string
}

export interface LayoutPlan {
  shell: ShellName
  brand: string
  links: NavLink[]
  /** Top-bar call to action; absent when the project declares no auth page. */
  cta?: NavLink
  note: string
}

/**
 * Page types that want a sidebar rather than a top bar. Derived rather than
 * declared as `spec.layout`, because adding that field would mean touching the
 * spec schema for a preference the page types already express.
 */
const SIDEBAR_PAGE_TYPES: readonly string[] = ['dashboard', 'settings', 'list-detail']

const NOTE_LIMIT = 140

export function pickShell(spec: ProjectSpec): ShellName {
  return spec.pages.some((page) => SIDEBAR_PAGE_TYPES.includes(page.pageType))
    ? 'SidebarShell'
    : 'AppShell'
}

/**
 * Every page the visitor can navigate to, in the order the spec declared them.
 * Auth pages are excluded because they are reached through the top-bar CTA —
 * and because a "Sign in" entry in the middle of the menu reads as a mistake.
 */
export function navLinks(spec: ProjectSpec): NavLink[] {
  return spec.pages
    .filter((page) => page.pageType !== 'auth')
    .map((page) => ({ label: page.title, to: page.route }))
}

/**
 * Reserving the CTA for the first auth page closes a hole that would otherwise
 * open the moment auth pages leave the nav: with no nav entry and no CTA, there
 * would be no way to reach the sign-in page at all.
 */
export function topBarCta(spec: ProjectSpec): NavLink | undefined {
  const auth = spec.pages.find((page) => page.pageType === 'auth')
  return auth === undefined ? undefined : { label: auth.title, to: auth.route }
}

/** The first sentence of the description, because a footer is not a paragraph. */
export function footerNote(spec: ProjectSpec): string {
  const description = spec.meta.description.trim()
  const firstSentence = description.split(/(?<=[。！？.!?])/)[0]?.trim() ?? ''
  const note = firstSentence === '' ? description : firstSentence

  if (note === '') return `© ${spec.meta.name}`
  return note.length > NOTE_LIMIT ? `${note.slice(0, NOTE_LIMIT).trimEnd()}…` : note
}

export function planLayout(spec: ProjectSpec): LayoutPlan {
  const cta = topBarCta(spec)
  return {
    shell: pickShell(spec),
    brand: spec.meta.name,
    links: navLinks(spec),
    ...(cta === undefined ? {} : { cta }),
    note: footerNote(spec),
  }
}
