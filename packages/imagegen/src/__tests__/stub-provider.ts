import type { ImageProcessor, ImageProvider, ImageRequest } from '../provider.js'
import type { SizeTier } from '../size.js'

/** Records every request so tests can assert on cache behaviour and prompt text. */
export class StubProvider implements ImageProvider {
  readonly name = 'stub'
  readonly requests: ImageRequest[] = []

  constructor(private readonly bytes: (request: ImageRequest) => Uint8Array = () => new Uint8Array([137, 80, 78, 71])) {}

  async generate(request: ImageRequest): Promise<Uint8Array> {
    this.requests.push(request)
    return this.bytes(request)
  }
}

/** Encodes the target size into the bytes so tests can see resize actually ran. */
export class StubProcessor implements ImageProcessor {
  readonly name = 'stub-processor'
  readonly resizes: SizeTier[] = []
  readonly transparencyFixes: number[] = []

  async resize(png: Uint8Array, target: SizeTier): Promise<Uint8Array> {
    this.resizes.push(target)
    return new Uint8Array([...png, target.w & 0xff, target.h & 0xff])
  }

  async ensureTransparent(png: Uint8Array): Promise<Uint8Array> {
    this.transparencyFixes.push(png.length)
    return new Uint8Array([...png, 0])
  }
}
