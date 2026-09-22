import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Resolves a request path inside a dist directory, or null if it escapes.
 *
 * The URL segment comes from the network, and `dist` sits next to the task's
 * `node_modules` junction and the platform's own workspace root — so the guard
 * is on the resolved path, after normalization, not on the raw string. Percent
 * encoding (`%2e%2e%2f`) and backslashes both decode before this runs.
 */
export function resolveDistPath(distDir: string, requestPath: string): string | null {
  const root = resolve(distDir)
  let decoded: string
  try {
    decoded = decodeURIComponent(requestPath)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null

  const relative = decoded.replace(/\\/g, '/').replace(/^\/+/, '')
  const target = resolve(join(root, relative === '' ? 'index.html' : relative))
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

export interface PreviewFile {
  path: string
  contentType: string
  size: number
  stream: () => NodeJS.ReadableStream
}

/** Falls back to `index.html` for extensionless paths so client routing works. */
export async function openPreviewFile(
  distDir: string,
  requestPath: string,
): Promise<PreviewFile | null> {
  const target = resolveDistPath(distDir, requestPath)
  if (target === null) return null

  const candidates = extname(target) === '' ? [join(target, 'index.html'), target] : [target]
  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => null)
    if (info === null || !info.isFile()) continue
    return {
      path: candidate,
      contentType: contentTypeFor(candidate),
      size: info.size,
      stream: () => createReadStream(candidate),
    }
  }
  return null
}
