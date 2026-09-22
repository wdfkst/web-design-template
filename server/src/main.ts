import { mkdir } from 'node:fs/promises'
import { FileImageCache } from '@vudt/imagegen'
import type { ImageProvider, ImageProcessor } from '@vudt/imagegen'
import {
  createOpenAIImageProvider,
  createOpenAISpecDrafter,
  createSharpImageProcessor,
} from '@vudt/providers'
import { resolve } from 'node:path'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import type { EffectiveSettings } from './settings.js'
import { probeSettings } from './settings-probe.js'
import { SettingsStore } from './settings-store.js'
import type { SpecDrafter } from './spec-source.js'

/**
 * Credentials are read here rather than in `loadConfig()` on purpose: they must
 * never reach `ServerConfig`, because a task record is what the API hands out and
 * config has a way of ending up copied onto one.
 */
function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]
  if (value === undefined || value.trim() === '') {
    throw new Error(`${key} is required to serve /tasks`)
  }
  return value
}

/**
 * Takes the key rather than the env: `main()` reads each key exactly once and hands
 * it to the factories and the probe, so a missing key still fails at startup and no
 * key is read in three places. It lives only in these closures.
 */
function buildDrafter(apiKey: string): (s: EffectiveSettings['spec']) => SpecDrafter {
  return (settings) =>
    createOpenAISpecDrafter({
      apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      sendResponseFormat: settings.sendResponseFormat,
    })
}

function buildImageProvider(
  apiKey: string,
  env: NodeJS.ProcessEnv,
): (s: EffectiveSettings['image']) => ImageProvider {
  return (settings) =>
    createOpenAIImageProvider({
      apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      ...(env.VUDT_IMAGE_QUALITY === undefined ? {} : { quality: env.VUDT_IMAGE_QUALITY }),
    })
}

/**
 * The processor is what downscales generated tiers to the sidecar's renderSize,
 * so running without it means shipping oversized images — worth an explicit
 * opt-out rather than a silent fallback.
 */
function buildProcessor(env: NodeJS.ProcessEnv): ImageProcessor | undefined {
  if (env.VUDT_DISABLE_IMAGE_PROCESSOR === '1') return undefined
  return createSharpImageProcessor()
}

async function main(): Promise<void> {
  const config = loadConfig()
  await mkdir(config.workspaceRoot, { recursive: true })
  await mkdir(config.imageCacheDir, { recursive: true })

  // Read once, here, and passed down: the keys stay in these closures and never
  // reach ServerConfig or AppDeps.
  const specApiKey = required(process.env, 'VUDT_SPEC_API_KEY')
  const imageApiKey = required(process.env, 'VUDT_IMAGE_API_KEY')

  const processor = buildProcessor(process.env)

  const settingsStore = new SettingsStore(resolve(process.cwd(), '.vudt/settings.json'))
  await settingsStore.load()

  const app = buildApp({
    templateDir: config.templateDir,
    workspaceRoot: config.workspaceRoot,
    drafter: buildDrafter(specApiKey),
    provider: buildImageProvider(imageApiKey, process.env),
    cache: new FileImageCache(config.imageCacheDir),
    settingsStore,
    // The keys go verbatim into the probe's authorization header and nowhere else:
    // Task 6 redacts by matching these literal strings, so encoding or truncating
    // one here would silently defeat that redaction.
    probe: (settings) => probeSettings(settings, { specApiKey, imageApiKey }),
    ...(processor === undefined ? {} : { processor }),
    concurrency: config.concurrency,
    maxPending: config.maxPending,
    maxAssets: config.maxAssets,
    specAttempts: config.specAttempts,
    buildTimeoutMs: config.buildTimeoutMs,
    webDistDir: config.webDistDir,
    fastify: { logger: true },
  })

  await app.listen({ host: config.host, port: config.port })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
