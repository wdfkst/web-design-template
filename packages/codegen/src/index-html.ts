import type { ProjectSpec } from '@vudt/spec'

/**
 * Replaces the placeholder `__PROJECT_NAME__` in index.html. The rest of the
 * file is left unchanged so manual edits to meta tags stay intact.
 */
export function renderIndexHtml(spec: ProjectSpec, template: string): string {
  return template.replace(/__PROJECT_NAME__/g, spec.meta.name)
}
