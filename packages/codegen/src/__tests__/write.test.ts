import { execFile } from 'node:child_process'
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateProject } from '../project.js'
import { writeProject } from '../write.js'
import { landingSpec } from './fixture.js'

const run = promisify(execFile)

const TEMPLATE_DIR = resolve(__dirname, '../../../templates/vue3-base')

let outDir: string

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'vudt-codegen-'))
  await writeProject(landingSpec(), { templateDir: TEMPLATE_DIR, outDir, nodeModules: 'link' })
}, 60_000)

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true })
})

describe('writeProject', () => {
  it('copies the template build config verbatim', async () => {
    const [ours, theirs] = await Promise.all([
      readFile(join(outDir, 'vite.config.ts'), 'utf8'),
      readFile(join(TEMPLATE_DIR, 'vite.config.ts'), 'utf8'),
    ])
    expect(ours).toBe(theirs)
  })

  it('copies every block SFC so containers cannot drift from the sidecars', async () => {
    const [ours, theirs] = await Promise.all([
      readdir(join(outDir, 'src', 'blocks')),
      readdir(join(TEMPLATE_DIR, 'src', 'blocks')),
    ])
    expect(ours.sort()).toEqual(theirs.sort())
  })

  it('removes the template placeholder page it did not regenerate', async () => {
    const pages = await readdir(join(outDir, 'src', 'pages'))
    expect(pages.sort()).toEqual(['HomePage.vue', 'PricingPage.vue', 'SigninPage.vue'])
  })

  it('substitutes the title into the copied index.html', async () => {
    const html = await readFile(join(outDir, 'index.html'), 'utf8')
    expect(html).toContain('<title>Acme Landing</title>')
    expect(html).not.toContain('__PROJECT_NAME__')
  })

  it('creates public/assets for the image side to fill', async () => {
    await expect(readdir(join(outDir, 'public', 'assets'))).resolves.toEqual([])
  })

  it('links the template node_modules instead of copying pnpm symlinks', async () => {
    const stats = await lstat(join(outDir, 'node_modules'))
    expect(stats.isSymbolicLink()).toBe(true)
    await expect(readdir(join(outDir, 'node_modules'))).resolves.toContain('vue')
  })

  it('skips node_modules by default', async () => {
    const bare = await mkdtemp(join(tmpdir(), 'vudt-bare-'))
    try {
      await writeProject(landingSpec(), { templateDir: TEMPLATE_DIR, outDir: bare })
      await expect(readdir(join(bare, 'node_modules'))).rejects.toThrow()
    } finally {
      await rm(bare, { recursive: true, force: true })
    }
  }, 30_000)

  it('never derives a path containing a traversal segment', () => {
    // The route regex already bars `..`, but the page-name mapping is the only
    // place a route reaches the filesystem, so pin the property here too.
    const generated = generateProject(landingSpec())
    for (const path of Object.keys(generated.files)) {
      expect(path.split('/')).not.toContain('..')
    }
  })
})

describe('the generated project builds', () => {
  it('passes vue-tsc with the template tsconfig', async () => {
    // Stand in empty PNGs so the build has real files to copy; the image side
    // writes these same paths, taken from expectedAssets.
    const { expectedAssets } = generateProject(landingSpec())
    for (const asset of expectedAssets) {
      await writeFile(join(outDir, asset.path), Buffer.alloc(0))
    }

    await run('node', [
      resolve(TEMPLATE_DIR, 'node_modules/vue-tsc/bin/vue-tsc.js'),
      '--noEmit',
      '-p',
      join(outDir, 'tsconfig.json'),
    ])
  }, 180_000)

  it('produces a dist with hashed asset references', async () => {
    await run(
      'node',
      [resolve(TEMPLATE_DIR, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'],
      { cwd: outDir },
    )
    const dist = await readdir(join(outDir, 'dist'))
    expect(dist).toContain('index.html')
    expect(dist).toContain('assets')
  }, 180_000)
})
