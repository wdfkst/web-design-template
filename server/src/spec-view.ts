import type { ProjectSpec } from '@vudt/spec'

/**
 * What `GET /tasks/:id/spec` hands out. Full spec content by design: this is an
 * internal tool, and the per-asset prompt is the first thing anyone wants when
 * an image comes back wrong.
 *
 * Still an explicit whitelist rather than `return spec`: if ProjectSpec ever
 * grows a field holding a filesystem path, spreading the object would leak it.
 */
export interface SpecView {
  meta: ProjectSpec['meta']
  theme: ProjectSpec['theme']
  styleBible: ProjectSpec['styleBible']
  pages: ProjectSpec['pages']
  assets: ProjectSpec['assets']
}

export function toSpecView(spec: ProjectSpec): SpecView {
  return {
    meta: spec.meta,
    theme: spec.theme,
    styleBible: spec.styleBible,
    pages: spec.pages,
    assets: spec.assets,
  }
}
