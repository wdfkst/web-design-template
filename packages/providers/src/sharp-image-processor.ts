import sharp from 'sharp'
import type { ImageProcessor, SizeTier } from '@vudt/imagegen'

export interface SharpImageProcessorOptions {
  /**
   * How close a corner pixel must be to the dominant backdrop colour to count as
   * background, as a 0-255 per-channel distance. Loose enough to catch the JPEG-ish
   * noise models leave in flat fills, tight enough not to eat a pale subject.
   */
  tolerance?: number
}

const DEFAULT_TOLERANCE = 24

interface Rgb {
  r: number
  g: number
  b: number
}

function corners(data: Buffer, width: number, height: number, channels: number): Rgb[] {
  const at = (x: number, y: number): Rgb => {
    const offset = (y * width + x) * channels
    return { r: data[offset]!, g: data[offset + 1]!, b: data[offset + 2]! }
  }
  return [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]
}

function within(a: Rgb, b: Rgb, tolerance: number): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance
  )
}

/**
 * Whether any pixel is less than fully opaque. `metadata().hasAlpha` only reports
 * that a channel exists, so it cannot tell an already-cut cutout from an RGBA
 * image the model left entirely opaque.
 */
async function hasRealTransparency(image: sharp.Sharp): Promise<boolean> {
  const metadata = await image.metadata()
  if (metadata.hasAlpha !== true) return false
  const stats = await image.stats()
  const alpha = stats.channels[3]
  return alpha !== undefined && alpha.min < 255
}

/**
 * The sharp-backed `ImageProcessor`. Lives in providers rather than imagegen so
 * the pipeline keeps working without a native raster dependency: imagegen treats
 * this as an optional seam, the server injects it, tests use a stub.
 */
export function createSharpImageProcessor(
  options: SharpImageProcessorOptions = {},
): ImageProcessor {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE

  return {
    name: 'sharp',

    async resize(png: Uint8Array, target: SizeTier): Promise<Uint8Array> {
      // `fit: 'fill'` on purpose. The tier was picked to match the sidecar's
      // aspect ratio already, so any residual difference is sub-pixel rounding;
      // 'cover' would crop those rows off the subject instead.
      const out = await sharp(Buffer.from(png))
        .resize({ width: target.w, height: target.h, fit: 'fill', withoutEnlargement: false })
        .png({ compressionLevel: 9 })
        .toBuffer()
      return new Uint8Array(out)
    },

    /**
     * Cuts a flat backdrop when the model ignored the transparency request.
     * Only fires when the image has no usable alpha and all four corners agree
     * on a colour — a photo-like or already-cut image is left untouched, because
     * guessing wrong here punches holes in the subject.
     */
    async ensureTransparent(png: Uint8Array): Promise<Uint8Array> {
      const image = sharp(Buffer.from(png))
      // An alpha *channel* proves nothing: models commonly return RGBA with every
      // pixel opaque. What matters is whether any pixel is actually transparent,
      // which means the model already did the cutting and we must not second-guess it.
      if (await hasRealTransparency(image)) return png

      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const { width, height, channels } = info
      if (width < 2 || height < 2 || channels !== 4) return png

      const found = corners(data, width, height, channels)
      const backdrop = found[0]!
      if (!found.every((corner) => within(corner, backdrop, tolerance))) return png

      const pixels = Buffer.from(data)
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const pixel = { r: pixels[offset]!, g: pixels[offset + 1]!, b: pixels[offset + 2]! }
        if (within(pixel, backdrop, tolerance)) pixels[offset + 3] = 0
      }

      const out = await sharp(pixels, { raw: { width, height, channels: 4 } })
        .png({ compressionLevel: 9 })
        .toBuffer()
      return new Uint8Array(out)
    },
  }
}
