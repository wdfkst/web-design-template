import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { writeProject, type WriteResult } from '@vudt/codegen'
import { generateAssets, type GenerateAssetsResult, type ImageCache, type ImageProcessor, type ImageProvider } from '@vudt/imagegen'
import type { ProjectSpec } from '@vudt/spec'
import { BuildError } from './errors.js'
import { runNodeSandboxed, tail, type SandboxResult } from './sandbox.js'
import { within, type TaskWorkspace } from './workspace.js'

export interface BuildLimits {
  timeoutMs?: number
  maxOldSpaceMb?: number
  maxOutputBytes?: number
}

export interface BuildTaskOptions {
  workspace: TaskWorkspace
  /** `packages/templates/vue3-base`, ideally with a warm node_modules. */
  templateDir: string
  provider: ImageProvider
  cache?: ImageCache
  processor?: ImageProcessor
  /** Refuses the task when the spec declares more images than this. */
  maxAssets?: number
  limits?: BuildLimits
  /** Skipped by default: vite build is the gate that matters for preview. */
  typecheck?: boolean
}

export interface BuildTaskResult {
  taskId: string
  projectDir: string
  /** Directory to serve in the preview iframe. */
  distDir: string
  write: WriteResult
  images: GenerateAssetsResult
  build: SandboxResult
  durationMs: number
}

const DEFAULT_MAX_ASSETS = 24

/**
 * The whole vertical slice, in the only order that works: code first, images
 * second, build last.
 *
 * Images cannot come first — their destination paths come from
 * `writeProject`/`generateProject`, and the build must not start until the files
 * the markup references exist, or vite silently emits a dist with dead hrefs.
 */
export async function buildTask(
  spec: ProjectSpec,
  options: BuildTaskOptions,
): Promise<BuildTaskResult> {
  const started = Date.now()
  const { workspace, templateDir, provider } = options
  const maxAssets = options.maxAssets ?? DEFAULT_MAX_ASSETS

  if (spec.assets.length > maxAssets) {
    // Cost ceiling, enforced before a single model call goes out.
    throw new BuildError(
      `spec declares ${spec.assets.length} assets, above the per-task limit of ${maxAssets}`,
    )
  }

  const projectDir = workspace.dir

  const write = await writeProject(spec, {
    templateDir: resolve(templateDir),
    outDir: projectDir,
    nodeModules: 'link',
  })

  const images = await generateAssets(spec, {
    provider,
    outDir: projectDir,
    ...(options.cache !== undefined ? { cache: options.cache } : {}),
    ...(options.processor !== undefined ? { processor: options.processor } : {}),
  })

  await assertExpectedAssetsExist(projectDir, write)

  if (options.typecheck === true) {
    await runToolOrThrow('vue-tsc', templateDir, 'node_modules/vue-tsc/bin/vue-tsc.js', [
      '--noEmit',
      '-p',
      join(projectDir, 'tsconfig.json'),
    ], projectDir, options.limits)
  }

  const build = await runToolOrThrow(
    'vite build',
    templateDir,
    'node_modules/vite/bin/vite.js',
    ['build', '--logLevel', 'warn'],
    projectDir,
    options.limits,
  )

  const distDir = join(projectDir, 'dist')
  await assertDistLooksRight(distDir)

  return {
    taskId: workspace.taskId,
    projectDir,
    distDir,
    write,
    images,
    build,
    durationMs: Date.now() - started,
  }
}

/**
 * Tools are resolved out of the template's node_modules, never the project's.
 * The project's copy is a junction to the same place, but going through the
 * template keeps the resolution independent of whatever the generated project
 * did to its own tree.
 */
async function runToolOrThrow(
  label: string,
  templateDir: string,
  relScript: string,
  args: readonly string[],
  cwd: string,
  limits: BuildLimits | undefined,
): Promise<SandboxResult> {
  const script = within(resolve(templateDir), relScript)
  const result = await runNodeSandboxed(script, args, {
    cwd,
    network: 'blocked',
    ...(limits?.timeoutMs !== undefined ? { timeoutMs: limits.timeoutMs } : {}),
    ...(limits?.maxOldSpaceMb !== undefined ? { maxOldSpaceMb: limits.maxOldSpaceMb } : {}),
    ...(limits?.maxOutputBytes !== undefined ? { maxOutputBytes: limits.maxOutputBytes } : {}),
  })

  if (result.code !== 0) {
    throw new BuildError(`${label} failed with code ${result.code}`, {
      stdout: tail(result.stdout),
      stderr: tail(result.stderr),
      code: result.code,
      signal: result.signal,
    })
  }
  return result
}

/** The join the manifest exists to guarantee — verified, not assumed. */
async function assertExpectedAssetsExist(projectDir: string, write: WriteResult): Promise<void> {
  for (const asset of write.expectedAssets) {
    const file = within(projectDir, asset.path)
    const info = await stat(file).catch(() => null)
    if (info === null || !info.isFile() || info.size === 0) {
      throw new BuildError(
        `asset ${asset.assetId} (${asset.contentHash}) is missing or empty at ${asset.path}`,
      )
    }
  }
}

async function assertDistLooksRight(distDir: string): Promise<void> {
  const entries = await readdir(distDir).catch(() => null)
  if (entries === null || !entries.includes('index.html')) {
    throw new BuildError(`build produced no index.html in ${distDir}`)
  }
}
