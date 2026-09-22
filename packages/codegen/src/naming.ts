/**
 * Route-to-identifier mapping. Deterministic and independent of anything the
 * model writes, so regenerating the same spec yields byte-identical files.
 */

/** `/` -> `HomePage`, `/pricing` -> `PricingPage`, `/docs/api` -> `DocsApiPage`. */
export function pageComponentName(route: string): string {
  const parts = route
    .split('/')
    .map((part) => part.replace(/^:/, 'by-'))
    .flatMap((part) => part.split('-'))
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ''))
    .filter((part) => part.length > 0)

  if (parts.length === 0) return 'HomePage'
  const pascal = parts.map((p) => p[0]!.toUpperCase() + p.slice(1)).join('')
  return /^[0-9]/.test(pascal) ? `Page${pascal}` : `${pascal}Page`
}

/** Vue Router record name. `/` -> `home`, `/docs/api` -> `docs-api`. */
export function routeName(route: string): string {
  const slug = route
    .split('/')
    .map((part) => part.replace(/^:/, 'by-'))
    .filter((part) => part.length > 0)
    .join('-')
    .toLowerCase()
  return slug.length > 0 ? slug : 'home'
}

/** Public URL for a generated image, relative so `base: './'` keeps working. */
export function assetHref(contentHash: string): string {
  return `./assets/${contentHash}.png`
}

/** Where the image generator must drop the file inside the project. */
export function assetFilePath(contentHash: string): string {
  return `public/assets/${contentHash}.png`
}
