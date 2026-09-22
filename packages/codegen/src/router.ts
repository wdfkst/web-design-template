import type { ProjectSpec } from '@vudt/spec'
import { pageComponentName, routeName } from './naming.js'

/**
 * Rewrites the template's router.ts with one entry per spec page. The top
 * comment is left in place so the file still explains what it is.
 */
export function renderRouter(spec: ProjectSpec): string {
  const imports = spec.pages
    .map((page) => {
      const name = pageComponentName(page.route)
      return `import ${name} from './pages/${name}.vue'`
    })
    .join('\n')

  const entries = spec.pages
    .map((page) => {
      const name = pageComponentName(page.route)
      // Auth pages render without the shell. The flag rides on the route so the
      // generated App.vue can decide per navigation instead of per project.
      const meta = page.pageType === 'auth' ? `\n    meta: { chrome: false },` : ''
      return (
        `  {\n` +
        `    path: ${JSON.stringify(page.route)},\n` +
        `    name: ${JSON.stringify(routeName(page.route))},\n` +
        `    component: ${name},${meta}\n` +
        `  },`
      )
    })
    .join('\n')

  return (
    `import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'\n` +
    `${imports}\n\n` +
    `/**\n` +
    ` * The generator rewrites this file, one entry per spec page. Hash history keeps\n` +
    ` * the built dist working inside a preview iframe with no server rewrites.\n` +
    ` */\n` +
    `const routes: RouteRecordRaw[] = [\n${entries}\n]\n\n` +
    `export const router = createRouter({ history: createWebHashHistory(), routes })\n`
  )
}
