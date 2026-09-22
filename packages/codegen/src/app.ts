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

  if (shell === 'AppShell') {
    consts.push(`const cta = ${cta === undefined ? 'undefined' : linkLiteral(cta)}`)
    consts.push(`const note = ${JSON.stringify(note)}`)
    attrs.push(`  :cta="cta"`, `  :note="note"`)
  } else if (cta !== undefined) {
    // The sidebar shell has a cta slot too: an auth page is in no nav entry, so
    // this button is its only way in.
    consts.push(`const cta = ${linkLiteral(cta)}`)
    attrs.push(`  :cta="cta"`)
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
