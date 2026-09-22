import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { ProjectSpec } from '@vudt/spec'
import { CodegenError } from './errors.js'
import { renderIndexHtml } from './index-html.js'
import { generateProject, type GeneratedProject } from './project.js'

export interface WriteOptions {
  /** Path to `packages/templates/vue3-base` (or a prebuilt copy with node_modules). */
  templateDir: string
  /** Empty or non-existent directory to materialize the project into. */
  outDir: string
  /**
   * How the generated project gets its dependencies.
   *
   * - `skip` (default): no deps; enough for pure codegen assertions.
   * - `link`: junction/symlink to the template's pre-installed `node_modules`.
   *   Instant, and what the build sandbox wants — the task never writes there,
   *   and pnpm's store is full of symlinks that do not survive a plain copy.
   * - `copy`: a real copy, for handing the project to the user standalone.
   */
  nodeModules?: 'skip' | 'link' | 'copy'
}

export interface WriteResult extends GeneratedProject {
  outDir: string
  /** Files actually written on top of the copied template. */
  written: string[]
}

/** Blocks a generated path from escaping outDir. */
function safeJoin(outDir: string, relPath: string): string {
  const target = resolve(outDir, relPath)
  const rel = relative(resolve(outDir), target)
  if (rel.startsWith('..') || rel.startsWith(`${sep}..`) || resolve(rel) === rel) {
    throw new CodegenError(`generated path "${relPath}" escapes the output directory`)
  }
  return target
}

/**
 * Copies the template base, then overlays the generated files.
 *
 * Copy-then-overlay rather than generate-everything: the template holds the
 * build config, the block SFCs whose geometry the sidecars mirror, and ideally
 * a warm `node_modules`. Regenerating those from strings would be the fastest
 * way to let the containers drift away from the sidecars.
 */
export async function writeProject(
  spec: ProjectSpec,
  options: WriteOptions,
): Promise<WriteResult> {
  const { templateDir, outDir, nodeModules = 'skip' } = options

  const generated = generateProject(spec)

  await mkdir(outDir, { recursive: true })
  await copyTemplate(templateDir, outDir, nodeModules)

  const written: string[] = []
  for (const [relPath, contents] of Object.entries(generated.files)) {
    const target = safeJoin(outDir, relPath)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf8')
    written.push(relPath)
  }

  // Pages are generated wholesale; a leftover placeholder would still typecheck
  // and still ship in the dist, so it has to go.
  await prunePlaceholderPages(outDir, generated)

  const htmlPath = join(outDir, 'index.html')
  const html = await readFile(htmlPath, 'utf8')
  await writeFile(htmlPath, renderIndexHtml(spec, html), 'utf8')
  written.push('index.html')

  await mkdir(join(outDir, 'public', 'assets'), { recursive: true })

  return { ...generated, outDir, written: written.sort() }
}

async function copyTemplate(
  templateDir: string,
  outDir: string,
  nodeModules: 'skip' | 'link' | 'copy',
): Promise<void> {
  const entries = await readdir(templateDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'dist') continue
    if (entry.name === 'node_modules') {
      if (nodeModules === 'skip') continue
      if (nodeModules === 'link') {
        // 'junction' is the only link kind Windows allows without elevation.
        await symlink(join(templateDir, entry.name), join(outDir, entry.name), 'junction')
        continue
      }
    }
    await cp(join(templateDir, entry.name), join(outDir, entry.name), {
      recursive: true,
      dereference: false,
    })
  }
}

async function prunePlaceholderPages(
  outDir: string,
  generated: GeneratedProject,
): Promise<void> {
  const pagesDir = join(outDir, 'src', 'pages')
  const kept = new Set(
    Object.keys(generated.files)
      .filter((p) => p.startsWith('src/pages/'))
      .map((p) => p.slice('src/pages/'.length)),
  )
  const existing = await readdir(pagesDir, { withFileTypes: true }).catch(() => [])
  for (const entry of existing) {
    if (entry.isFile() && !kept.has(entry.name)) {
      await rm(join(pagesDir, entry.name))
    }
  }
}
