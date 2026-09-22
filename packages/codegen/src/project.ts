import type { ProjectSpec } from '@vudt/spec'
import { renderApp } from './app.js'
import { assetFilePath, pageComponentName } from './naming.js'
import { renderPage } from './page.js'
import { renderRouter } from './router.js'
import { renderTokensCss } from './tokens.js'

/** One image the generator expects the image side to produce. */
export interface ExpectedAssetFile {
  assetId: string
  contentHash: string
  /** Project-relative destination, e.g. `public/assets/ab12….png`. */
  path: string
  transparent: boolean
}

export interface GeneratedProject {
  /** Project-relative path -> file contents. Overlaid on top of the template. */
  files: Record<string, string>
  /** Files the image generator must write before the build will look right. */
  expectedAssets: ExpectedAssetFile[]
}

/**
 * Pure spec -> file overlay. Everything else in the project comes from the
 * template base copied verbatim, which is why this stays testable without a
 * filesystem: the only generated artifacts are the pages, the router, and the
 * theme tokens.
 *
 * App.vue is generated rather than copied because the nav, the CTA and the
 * shell choice all come from `spec.pages` — it is the one file where the
 * project's cross-page structure is written down.
 */
export function generateProject(spec: ProjectSpec): GeneratedProject {
  const files: Record<string, string> = {}

  for (const page of spec.pages) {
    files[`src/pages/${pageComponentName(page.route)}.vue`] = renderPage(spec, page)
  }

  files['src/App.vue'] = renderApp(spec)
  files['src/router.ts'] = renderRouter(spec)
  files['src/styles/tokens.css'] = renderTokensCss(spec)

  const expectedAssets = spec.assets.map((asset) => ({
    assetId: asset.id,
    contentHash: asset.contentHash,
    path: assetFilePath(asset.contentHash),
    transparent: asset.transparent,
  }))

  return { files, expectedAssets }
}

/** Template files the generator always replaces, so stale copies can be pruned. */
export const REPLACED_TEMPLATE_FILES = [
  'src/pages/HomePage.vue',
  'src/router.ts',
  'src/styles/tokens.css',
] as const
