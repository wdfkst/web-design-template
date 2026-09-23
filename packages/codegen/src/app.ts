import type { ProjectSpec } from '@vudt/spec'
import { planLayout } from './layouts.js'

function linkLiteral(link: { label: string; to: string }): string {
  return `{ label: ${JSON.stringify(link.label)}, to: ${JSON.stringify(link.to)} }`
}

/**
 * Builds the project-level App.vue.
 *
 * This is where the cross-page invariant becomes structural: the nav entries and
 * the CTA are written here from `spec.pages`, so a link can only ever name a
 * route the router actually declares. The model never writes any of it.
 */
export function renderApp(spec: ProjectSpec): string {
  const { shell, brand, links, cta, note } = planLayout(spec)

  const consts = [
    `const brand = ${JSON.stringify(brand)}`,
    `const links = [\n${links.map((link) => `  ${linkLiteral(link)},`).join('\n')}\n]`,
  ]
  const attrs = [`  :brand="brand"`, `  :links="links"`]

  // `planLayout` leaves `cta` absent rather than undefined so the two cases stay
  // distinguishable — binding `:cta` to a dead `undefined` const would throw that
  // distinction away. `cta` is an optional prop on both AppShell and SidebarShell
  // (`cta?: NavLink` in each), so omitting the binding and passing `undefined` are
  // the same thing at runtime.
  //
  // Emitted once, outside the per-shell branches. Both shells take a cta: on the
  // sidebar it is an auth page's only way in, since an auth page appears in no nav
  // entry. Keeping one copy is the point — when this was branched per shell, one
  // branch emitted a dead `const cta = undefined` and the other did not.
  if (cta !== undefined) {
    consts.push(`const cta = ${linkLiteral(cta)}`)
    attrs.push(`  :cta="cta"`)
  }

  if (shell === 'AppShell') {
    consts.push(`const note = ${JSON.stringify(note)}`)
    attrs.push(`  :note="note"`)
  }

  attrs.push(`  :chromeless="chromeless"`)

  const script = [
    `import { computed } from 'vue'`,
    `import { useRoute } from 'vue-router'`,
    `import ${shell} from './layouts/${shell}.vue'`,
    '',
    ...consts,
    '',
    `const route = useRoute()`,
    `const chromeless = computed(() => route.meta.chrome === false)`,
  ].join('\n')

  return (
    `<script setup lang="ts">\n` +
    `${script}\n` +
    `</script>\n\n` +
    `<template>\n` +
    `  <${shell}\n` +
    `${attrs.join('\n')}\n` +
    `  >\n` +
    `    <RouterView />\n` +
    `  </${shell}>\n` +
    `</template>\n`
  )
}
