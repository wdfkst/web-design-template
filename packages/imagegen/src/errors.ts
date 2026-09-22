/**
 * Raised when image generation cannot honour the manifest contract — a provider
 * returned an empty buffer, a cache entry is unreadable, a requested aspect
 * ratio has no supported tier. Like CodegenError these are contract failures:
 * silently substituting a placeholder would let a broken image reach dist and
 * survive the build, which is exactly what the manifest exists to prevent.
 */
export class ImagegenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImagegenError'
  }
}
