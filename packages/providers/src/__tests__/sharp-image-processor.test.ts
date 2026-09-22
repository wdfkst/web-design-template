import { describe, expect, test } from 'vitest'
import sharp from 'sharp'
import { createSharpImageProcessor } from '../sharp-image-processor.js'

/** Flat opaque PNG, no alpha channel. */
async function flatPng(w: number, h: number, rgb: [number, number, number]): Promise<Uint8Array> {
  const out = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  })
    .png()
    .toBuffer()
  return new Uint8Array(out)
}

/** Opaque backdrop with a differently-coloured block in the middle. */
async function subjectOnBackdrop(
  w: number,
  h: number,
  backdrop: [number, number, number],
  subject: [number, number, number],
): Promise<Uint8Array> {
  const patch = await sharp({
    create: {
      width: Math.floor(w / 2),
      height: Math.floor(h / 2),
      channels: 3,
      background: { r: subject[0], g: subject[1], b: subject[2] },
    },
  })
    .png()
    .toBuffer()

  const out = await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: backdrop[0], g: backdrop[1], b: backdrop[2] },
    },
  })
    .composite([{ input: patch, left: Math.floor(w / 4), top: Math.floor(h / 4) }])
    .png()
    .toBuffer()
  return new Uint8Array(out)
}

async function meta(png: Uint8Array) {
  return sharp(Buffer.from(png)).metadata()
}

async function alphaAt(png: Uint8Array, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(Buffer.from(png))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return data[(y * info.width + x) * info.channels + 3]!
}

describe('createSharpImageProcessor', () => {
  test('resizes down to the render size exactly', async () => {
    const processor = createSharpImageProcessor()
    const source = await flatPng(1024, 768, [10, 120, 130])

    const resized = await processor.resize(source, { w: 512, h: 384 })
    const info = await meta(resized)

    expect(info.width).toBe(512)
    expect(info.height).toBe(384)
    expect(info.format).toBe('png')
  })

  test('resize honours the exact target even when it means enlarging', async () => {
    // The pipeline picks a tier >= renderSize, so this is a guard against the
    // processor silently refusing a target rather than a case we expect.
    const processor = createSharpImageProcessor()
    const resized = await processor.resize(await flatPng(64, 64, [0, 0, 0]), { w: 128, h: 128 })
    const info = await meta(resized)
    expect([info.width, info.height]).toEqual([128, 128])
  })

  test('resize output stays a decodable png', async () => {
    const processor = createSharpImageProcessor()
    const resized = await processor.resize(await flatPng(300, 200, [200, 30, 30]), { w: 150, h: 100 })
    await expect(meta(resized)).resolves.toMatchObject({ format: 'png' })
  })

  test('ensureTransparent cuts a uniform backdrop and keeps the subject', async () => {
    const processor = createSharpImageProcessor()
    const source = await subjectOnBackdrop(80, 80, [255, 255, 255], [20, 40, 200])

    const cut = await processor.ensureTransparent!(source)

    expect(await meta(cut)).toMatchObject({ hasAlpha: true })
    expect(await alphaAt(cut, 1, 1)).toBe(0)
    expect(await alphaAt(cut, 40, 40)).toBe(255)
  })

  test('ensureTransparent leaves an image that already has alpha untouched', async () => {
    const processor = createSharpImageProcessor()
    const source = new Uint8Array(
      await sharp({
        create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .png()
        .toBuffer(),
    )

    const result = await processor.ensureTransparent!(source)
    expect(result).toBe(source)
  })

  test('ensureTransparent still cuts when the png is RGBA but fully opaque', async () => {
    // Models routinely return an alpha channel with every pixel opaque. An
    // `hasAlpha` check alone reads that as "already cut" and skips the cut.
    const processor = createSharpImageProcessor()
    const opaqueRgba = new Uint8Array(
      await sharp(Buffer.from(await subjectOnBackdrop(80, 80, [255, 255, 255], [20, 40, 200])))
        .ensureAlpha()
        .png()
        .toBuffer(),
    )
    expect(await meta(opaqueRgba)).toMatchObject({ hasAlpha: true })

    const cut = await processor.ensureTransparent!(opaqueRgba)

    expect(await alphaAt(cut, 1, 1)).toBe(0)
    expect(await alphaAt(cut, 40, 40)).toBe(255)
  })

  test('ensureTransparent leaves the image alone when corners disagree', async () => {
    const processor = createSharpImageProcessor()
    // A gradient has four different corners: no single flat backdrop to cut.
    const gradient = new Uint8Array(
      await sharp({
        create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .composite([
          {
            input: await sharp({
              create: { width: 20, height: 40, channels: 3, background: { r: 250, g: 250, b: 250 } },
            })
              .png()
              .toBuffer(),
            left: 20,
            top: 0,
          },
        ])
        .png()
        .toBuffer(),
    )

    const result = await processor.ensureTransparent!(gradient)
    expect(result).toBe(gradient)
  })

  test('tolerance controls how close a pixel must be to count as backdrop', async () => {
    const source = await subjectOnBackdrop(60, 60, [255, 255, 255], [235, 235, 235])

    const tight = await createSharpImageProcessor({ tolerance: 4 }).ensureTransparent!(source)
    expect(await alphaAt(tight, 30, 30)).toBe(255)

    const loose = await createSharpImageProcessor({ tolerance: 40 }).ensureTransparent!(source)
    expect(await alphaAt(loose, 30, 30)).toBe(0)
  })

  test('reports its name so task records can show which processor ran', () => {
    expect(createSharpImageProcessor().name).toBe('sharp')
  })
})
