import type { Page, ProjectSpec } from '@vudt/spec'
import { getSlot } from '@vudt/blocks'
import { assetHref } from '../naming.js'

export function adminLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
export function adminPageProps(spec: ProjectSpec, page: Page): Record<string, unknown> {
  const blocks = page.blocks.map(block => {
    const assets: Record<string, unknown> = {}
    for (const [key, id] of Object.entries(block.assetBindings)) {
      const slot = getSlot(block.component, key)
      const asset = spec.assets.find(item => item.id === id)
      if (!slot || !asset || asset.renderSize.w !== slot.renderSize.w || asset.renderSize.h !== slot.renderSize.h) throw new Error(`Invalid admin asset binding: ${id}`)
      assets[key] = { src: assetHref(asset.contentHash), alt: asset.alt, w: slot.renderSize.w, h: slot.renderSize.h }
    }
    return { ...block.props, assets }
  })
  return { title: page.title, ...(page.pageType === 'auth' ? { panel: blocks[0] ?? {} } : { config: page.admin, emptyPanel: blocks[page.blocks.findIndex(block => block.component === 'EmptyStatePanel')], welcomePanel: blocks[page.blocks.findIndex(block => block.component === 'AdminWelcomePanel')] }) }
}
export function renderAdminPage(_spec: ProjectSpec, page: Page): string {
  const components = { list: 'AdminListPage', detail: 'AdminDetailPage', form: 'AdminFormPage', settings: 'AdminSettingsPage', workbench: 'AdminWorkbenchPage' }
  const component = page.pageType === 'auth' ? 'AdminAuthPage' : page.admin ? components[page.admin.mode] : undefined
  if (!component) throw new Error(`Missing admin mode: ${page.route}`)
  return `<script setup lang="ts">\nimport ${component} from '../../components/admin/${component}.vue'\nimport { pageProps } from './config'\n</script>\n<template><${component} v-bind="pageProps" /></template>\n`
}
