import type { ImageProvider, ImageRequest } from '@vudt/imagegen'

export interface OpenAIImageProviderOptions {
  apiKey: string
  model: string
  baseUrl?: string
  fetch?: typeof fetch
  /** Passed through when the model supports it; ignored by models that do not. */
  quality?: string
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

interface ImagesReply {
  data?: { b64_json?: string | null; url?: string | null }[]
}

function decodeBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

/**
 * An `ImageProvider` backed by an OpenAI-compatible `/images/generations`
 * endpoint.
 *
 * Geometry is never negotiated here: `request.size` already is a tier the
 * pipeline chose from the sidecar's aspect ratio, so it is sent verbatim and the
 * downscale to `renderSize` is the processor's job. An empty or missing payload
 * throws rather than degrading to a placeholder — a blank PNG would still build
 * successfully, which is the failure the manifest exists to catch.
 */
export function createOpenAIImageProvider(options: OpenAIImageProviderOptions): ImageProvider {
  const { apiKey, model } = options
  if (apiKey.trim() === '') throw new Error('createOpenAIImageProvider: apiKey is required')
  if (model.trim() === '') throw new Error('createOpenAIImageProvider: model is required')

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const fetchImpl = options.fetch ?? globalThis.fetch

  return {
    name: `openai-image:${model}`,
    async generate(request: ImageRequest): Promise<Uint8Array> {
      const prompt =
        request.negativePrompt.trim() === ''
          ? request.prompt
          : `${request.prompt}\n\nAvoid: ${request.negativePrompt}`

      const response = await fetchImpl(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: `${request.size.w}x${request.size.h}`,
          output_format: 'png',
          ...(request.transparent ? { background: 'transparent' } : {}),
          ...(options.quality === undefined ? {} : { quality: options.quality }),
        }),
      })

      if (!response.ok) {
        // Status only: an image endpoint's error body can echo the prompt, and
        // the prompt is request content we do not want in an exception message.
        throw new Error(`image provider request failed with status ${response.status}`)
      }

      const reply = (await response.json()) as ImagesReply
      const encoded = reply.data?.[0]?.b64_json
      const href = reply.data?.[0]?.url

      let bytes: Uint8Array
      if (typeof encoded === 'string' && encoded.trim() !== '') {
        bytes = decodeBase64(encoded)
      } else if (typeof href === 'string' && href.trim() !== '') {
        // Relays forwarding gpt-image-1 commonly answer with a URL rather than
        // inline base64. No authorization header: these are usually signed
        // object-storage links on a third-party host, and sending the key there
        // would widen its exposure. Status only in the error, same reason as above.
        const image = await fetchImpl(href)
        if (!image.ok) {
          throw new Error(
            `image provider url fetch failed with status ${image.status} for asset ${request.assetId}`,
          )
        }
        bytes = new Uint8Array(await image.arrayBuffer())
      } else {
        throw new Error(
          `image provider returned no inline image data for asset ${request.assetId}`,
        )
      }

      if (bytes.byteLength === 0) {
        throw new Error(`image provider returned an empty image for asset ${request.assetId}`)
      }
      return bytes
    },
  }
}
