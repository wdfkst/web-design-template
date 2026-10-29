import type { ProjectSpec } from '@vudt/spec'
import type { GeneratedProject } from '../project.js'
import { assetFilePath, pageComponentName } from '../naming.js'
import { renderAdminData } from './data.js'
import { renderAdminTheme } from './theme.js'
import { renderAdminReadme } from './readme.js'
import { renderAdminNavigation } from './navigation.js'
import { adminLiteral, adminPageProps, renderAdminPage } from './page.js'

export function generateAdminProject(spec: ProjectSpec): GeneratedProject {
  const files = { ...renderAdminData(spec), ...renderAdminTheme(spec) }
  files['README.md'] = renderAdminReadme()
  const names = new Set<string>()
  for (const page of spec.pages) {
    const name = pageComponentName(page.route)
    if (names.has(name.toLowerCase())) throw new Error(`Admin module collision: ${page.route}`)
    names.add(name.toLowerCase())
    files[`src/modules/${name}/index.vue`] = renderAdminPage(spec, page)
    const configType = page.admin?.mode === 'list' ? 'AdminListConfig' : page.admin?.mode === 'detail' ? 'AdminDetailConfig' : page.admin?.mode === 'form' ? 'AdminFormConfig' : page.admin?.mode === 'workbench' ? 'WorkbenchConfig' : undefined
    files[`src/modules/${name}/config.ts`] = `${configType ? `import type { ${configType} } from '../../data/admin-config'\n` : ''}export const pageProps = ${adminLiteral(adminPageProps(spec, page))}${configType ? ` satisfies { title: string; config: ${configType}; emptyPanel?: unknown }` : ''}\n`
  }
  const nav = renderAdminNavigation(spec)
  files['src/router.ts'] = nav.router
  files['src/navigation.ts'] = nav.navigation
  files['src/pages/NotFoundPage.vue'] = `<script setup lang="ts">\nconst home = ${adminLiteral(spec.pages.find(page => page.pageType !== 'auth')?.route ?? '/')}\n</script>\n<template><section><h1>页面不存在</h1><RouterLink :to="home">返回工作空间</RouterLink></section></template>\n`
  return { files, expectedAssets: spec.assets.map(asset => ({ assetId: asset.id, contentHash: asset.contentHash, path: assetFilePath(asset.contentHash), transparent: asset.transparent })) }
}
