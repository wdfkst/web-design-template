import { resolve } from 'node:path'

export interface ServerConfig {
  host: string
  port: number
  /** Root for per-task directories; each task gets its own child. */
  workspaceRoot: string
  /** `packages/templates/vue3-base`, ideally with a warm node_modules. */
  templateDir: string
  /** Shared across tasks: the cache key is the content hash, not the task id. */
  imageCacheDir: string
  concurrency: number
  maxPending: number
  maxAssets: number
  specAttempts: number
  buildTimeoutMs: number
  /** Built console. Must be same-origin with the API (preview CSP requirement). */
  webDistDir: string
}

const DEFAULTS = {
  host: '127.0.0.1',
  port: 4300,
  concurrency: 1,
  maxPending: 32,
  maxAssets: 24,
  specAttempts: 3,
  buildTimeoutMs: 180_000,
} as const

function intFromEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer, got ${JSON.stringify(raw)}`)
  }
  return value
}

/**
 * Reads config from the environment. Model credentials are deliberately absent
 * from this shape: they are read where the provider is constructed and never
 * copied onto a task record, because task records are what the API hands out.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): ServerConfig {
  return {
    host: env.VUDT_HOST ?? DEFAULTS.host,
    port: intFromEnv(env, 'VUDT_PORT', DEFAULTS.port),
    workspaceRoot: resolve(cwd, env.VUDT_WORKSPACE_ROOT ?? '.vudt/tasks'),
    templateDir: resolve(cwd, env.VUDT_TEMPLATE_DIR ?? 'packages/templates/vue3-base'),
    imageCacheDir: resolve(cwd, env.VUDT_IMAGE_CACHE_DIR ?? '.vudt/image-cache'),
    concurrency: intFromEnv(env, 'VUDT_CONCURRENCY', DEFAULTS.concurrency),
    maxPending: intFromEnv(env, 'VUDT_MAX_PENDING', DEFAULTS.maxPending),
    maxAssets: intFromEnv(env, 'VUDT_MAX_ASSETS', DEFAULTS.maxAssets),
    specAttempts: intFromEnv(env, 'VUDT_SPEC_ATTEMPTS', DEFAULTS.specAttempts),
    buildTimeoutMs: intFromEnv(env, 'VUDT_BUILD_TIMEOUT_MS', DEFAULTS.buildTimeoutMs),
    webDistDir: resolve(cwd, env.VUDT_WEB_DIST_DIR ?? 'web/dist'),
  }
}
