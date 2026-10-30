export function safeCoverUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\s\x00-\x1f\x7f\\]/.test(value)) return undefined
  if (value.startsWith('./covers/')) {
    const parts = value.slice('./covers/'.length).split('/')
    return parts.every(part => /^[a-zA-Z0-9_.-]+$/.test(part) && part !== '.' && part !== '..') ? value : undefined
  }
  if (!value.startsWith('https://')) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? value : undefined
  } catch { return undefined }
}
