import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyAdminStyle, ADMIN_STYLE_IDS, finalizeSpec, getCurrentAdminStyleReference, ProjectSpecInputSchema } from '../../packages/spec/src/index.js'
import { deriveSpecInput } from '../../packages/templates/blocks/src/index.js'
import { buildTask, WorkspaceRoot } from '../../packages/build/src/index.js'
import { createSharpImageProcessor } from '../../packages/providers/src/sharp-image-processor.js'
import { createCoffeePreviewDraft, createCoffeePreviewRows } from './fixture.js'
import { computeTemplateFingerprint, defaultOutputDir, previewAssetKind, repositoryRoot, validatePreviewManifest, type PreviewManifest } from './manifest.js'

/** Build and validate before touching the last successful output. */
export async function publishPreviewBuild(outputDir: string, build: (staging: string) => Promise<void>): Promise<void> {
  const target = resolve(outputDir)
  await mkdir(dirname(target), { recursive: true })
  const transaction = await mkdtemp(join(dirname(target), '.admin-preview-'))
  const staging = join(transaction, 'staging'), backup = join(transaction, 'backup')
  await mkdir(staging)
  let backedUp = false
  try {
    await build(staging)
    await validatePreviewManifest(staging)
    const existing = await lstat(target).catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
    if (existing) {
      if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error('Preview output must be a regular directory')
      await rename(target, backup)
      backedUp = true
    }
    try { await rename(staging, target) }
    catch (error) {
      if (backedUp) { await rename(backup, target); backedUp = false }
      throw error
    }
    backedUp = false
  } finally {
    // Preserve the backup if filesystem recovery itself failed.
    if (!backedUp) await rm(transaction, { recursive: true, force: true })
  }
}

export async function buildAdminStylePreviews(outputDir: string): Promise<void> {
  await publishPreviewBuild(outputDir, async staging => {
    const work = await mkdtemp(join(dirname(staging), 'projects-'))
    const manifest: PreviewManifest = { schemaVersion: 1, templateFingerprint: await computeTemplateFingerprint(), styles: [] }
    try {
      // Preview-only data overlay; exported user projects retain the normal seed generator.
      const template = join(repositoryRoot, 'packages/templates/vue3-admin')
      const previewTemplate = join(work, 'template')
      await cp(template, previewTemplate, { recursive: true, filter: path => !['node_modules', 'dist', '__tests__'].some(part => relative(template, path).split(sep).includes(part)) })
      await symlink(join(template, 'node_modules'), join(previewTemplate, 'node_modules'), 'junction')
      await writeFile(join(previewTemplate, 'src/preview-seed.ts'), `import { MOCK_ROWS } from './data/mock'\nObject.assign(MOCK_ROWS, ${JSON.stringify(createCoffeePreviewRows())})\n`)
      await writeFile(join(previewTemplate, 'src/preview-formats.ts'), `import { watchEffect } from 'vue'
import { useAdminCollection } from './composables/useAdminCollection'
const products = useAdminCollection('products')
watchEffect(() => {
  for (const row of products.rows.value) row.displayPrice = typeof row.price === 'number' ? '¥' + row.price.toFixed(2) : '—'
})
`)
      const main = await readFile(join(previewTemplate, 'src/main.ts'), 'utf8')
      await writeFile(join(previewTemplate, 'src/main.ts'), `import './preview-seed'\nimport './preview-formats'\n${main}`)
      for (const id of ADMIN_STYLE_IDS) {
        const ref = getCurrentAdminStyleReference(id)
        if (!ref) throw new Error(`Missing registered style: ${id}`)
        const draft = createCoffeePreviewDraft()
        const assetKind = previewAssetKind(id)
        if (assetKind === 'illustration') {
          draft.pages[0]!.blocks[0]!.props.body += ' 当前插画为本地 SVG 示意，并非 AI 成图。'
          draft.pages[0]!.blocks[0]!.content.illustration.alt = '咖啡器具本地 SVG 示意，非 AI 成图'
        }
        const applied = applyAdminStyle(draft, ref, 42)
        if (!applied.ok) throw new Error(applied.feedback)
        const derived = deriveSpecInput(applied.value)
        if (!derived.ok) throw new Error(derived.feedback)
        const spec = finalizeSpec(ProjectSpecInputSchema.parse(derived.value))
        const processor = createSharpImageProcessor()
        const localAsset = await readFile(join(repositoryRoot, 'scripts/admin-style-previews/assets', `${id}.${assetKind === 'illustration' ? 'svg' : 'png'}`))
        const result = await buildTask(spec, {
          workspace: await new WorkspaceRoot(work).allocate(id),
          templateDir: join(repositoryRoot, 'packages/templates/vue3-base'),
          adminTemplateDir: previewTemplate,
          provider: { name: 'local-preview-assets', async generate() { return localAsset } },
          processor,
          typecheck: true,
        })
        await cp(result.distDir, join(staging, id, String(ref.version)), { recursive: true })
        const files = (await readdir(result.distDir, { recursive: true, withFileTypes: true }))
          .filter(entry => entry.isFile())
          .map(entry => relative(result.distDir, join(entry.parentPath, entry.name)).split(sep).join('/')).sort()
        manifest.styles.push({ ...ref, entry: `${id}/${ref.version}/index.html`, assetKind, files })
      }
      if (manifest.templateFingerprint !== await computeTemplateFingerprint()) throw new Error('Template inputs changed during preview build; retry')
      await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    } finally { await rm(work, { recursive: true, force: true }) }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2]
  if (command !== 'build' && command !== 'check') throw new Error('Usage: tsx scripts/admin-style-previews/build.ts <build|check>')
  const run = command === 'build' ? buildAdminStylePreviews : validatePreviewManifest
  await run(defaultOutputDir)
  console.log(`Admin previews ${command}: five styles verified`)
}
