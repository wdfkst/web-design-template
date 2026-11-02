import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN_STYLE_IDS, getCurrentAdminStyleReference, type AdminStyleId } from '../../packages/spec/src/index.js'

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const defaultOutputDir = join(repositoryRoot, 'web/public/admin-style-previews')
export type PreviewAssetKind = 'ai-sample' | 'illustration'
export interface PreviewManifest {
  schemaVersion: 1
  templateFingerprint: string
  styles: { id: AdminStyleId; version: number; entry: string; assetKind: PreviewAssetKind; files: string[] }[]
}
export function previewAssetKind(id: AdminStyleId): PreviewAssetKind {
  return id === 'porcelain' || id === 'aurora' ? 'illustration' : 'ai-sample'
}
const inputPaths = ['packages/spec/src', 'packages/templates/vue3-admin', 'packages/templates/blocks/src', 'packages/codegen/src', 'packages/build/src', 'packages/imagegen/src', 'packages/providers/src/sharp-image-processor.ts', 'scripts/admin-style-previews', 'pnpm-lock.yaml']
const excluded = new Set(['node_modules', 'dist', '__tests__', '.git', '.vite'])

export async function computeTemplateFingerprint(root = repositoryRoot, inputs = inputPaths): Promise<string> {
  const files: string[] = []
  async function collect(relative: string): Promise<void> {
    const info = await lstat(join(root, relative))
    if (info.isSymbolicLink()) throw new Error(`Fingerprint input cannot be a symlink: ${relative}`)
    if (info.isDirectory()) {
      for (const name of await readdir(join(root, relative))) {
        if (!excluded.has(name)) await collect(`${relative}/${name}`)
      }
    } else if (info.isFile()) files.push(relative)
  }
  for (const input of inputs) await collect(input)
  const hash = createHash('sha256')
  for (const file of files.sort()) {
    const bytes = await readFile(join(root, file))
    hash.update(`${Buffer.byteLength(file)}:${file}:${bytes.length}:`).update(bytes)
  }
  return hash.digest('hex')
}

export async function validatePreviewManifest(dir: string): Promise<void> {
  const manifest: unknown = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid preview manifest')
  const value = manifest as Partial<PreviewManifest>
  if (value.schemaVersion !== 1 || value.templateFingerprint !== await computeTemplateFingerprint()) throw new Error('Preview manifest version or template fingerprint mismatch')
  if (!Array.isArray(value.styles) || value.styles.length !== ADMIN_STYLE_IDS.length) throw new Error('Incomplete preview styles')
  const root = await realpath(dir)
  for (const id of ADMIN_STYLE_IDS) {
    const items = value.styles.filter(item => item?.id === id)
    const item = items[0], ref = getCurrentAdminStyleReference(id)
    if (!ref || items.length !== 1 || !item || item.version !== ref.version || item.assetKind !== previewAssetKind(id)) throw new Error(`Invalid preview style: ${id}`)
    // Exact allowlist also rejects absolute, traversal, URL and backslash entries.
    if (item.entry !== `${id}/${ref.version}/index.html`) throw new Error(`Invalid preview entry: ${id}`)
    const path = await realpath(join(dir, item.entry))
    if (!path.startsWith(root + sep)) throw new Error(`Preview entry escapes output: ${id}`)
    const info = await lstat(path)
    if (!info.isFile() || info.size === 0) throw new Error(`Missing preview entry: ${id}`)
    const projectRoot = await realpath(dirname(path))
    if (!Array.isArray(item.files) || !item.files.includes('index.html') || new Set(item.files).size !== item.files.length) throw new Error('Invalid preview file inventory')
    const visited = new Set<string>()
    for (const file of item.files) {
      if (typeof file !== 'string' || !file || file.split('/').some(part => !part || part === '.' || part === '..') || /[:\\\\?#]/.test(file)) throw new Error('Invalid preview file path')
      await validateResources(join(projectRoot, file), projectRoot, visited)
    }
  }
}

async function validateResources(entry: string, root: string, visited = new Set<string>()): Promise<void> {
  const path = await realpath(entry)
  if (!path.startsWith(root + sep)) throw new Error('Preview resource escapes project')
  if (visited.has(path)) return
  visited.add(path)
  const info = await lstat(path)
  if (!info.isFile() || info.size === 0) throw new Error('Missing preview resource')
  if (!/\.(html|css)$/.test(path)) return
  const source = await readFile(path, 'utf8')
  const references = path.endsWith('.html')
    ? [...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]!)
    : [...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(match => match[1]!)
  for (const reference of references) {
    if (reference.startsWith('data:') || reference.startsWith('#')) continue
    if (/^(?:[a-z]+:|\/)|\\/.test(reference)) throw new Error('Preview resource must be local and relative')
    const relative = decodeURIComponent(reference.split(/[?#]/)[0]!)
    await validateResources(resolve(dirname(path), relative), root, visited)
  }
}
