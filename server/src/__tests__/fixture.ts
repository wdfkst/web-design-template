import type { ImageProvider, ImageRequest } from '@vudt/imagegen'
import type { SpecDraftRequest, SpecDrafter } from '../spec-source.js'

const theme = {
  colorTokens: {
    primary: '#4f46e5',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    foreground: '#0f172a',
    muted: '#64748b',
  },
  radius: 'lg',
  spacing: 'normal',
  fontPair: { heading: 'Inter', body: 'Inter' },
  mode: 'light',
} as const

const styleBible = {
  artStyle: 'flat-vector',
  lineWeight: 'none',
  shading: 'soft-gradient',
  perspective: 'three-quarter',
  palette: ['#4f46e5', '#0ea5e9', '#f59e0b'],
  backgroundTreatment: 'subtle-gradient',
  negativePrompt: 'no text, no watermark',
  seed: 1234,
} as const

/**
 * The raw object a drafter is expected to return: a draft, not a spec. Blocks
 * carry subject text only — every aspectRatio/renderSize/id is derived from the
 * sidecars by `deriveSpecInput`, so hand-writing geometry here would test a
 * shape the model is never allowed to produce.
 */
export function landingDraft(): unknown {
  return {
    meta: {
      name: 'Acme Landing',
      description: 'A marketing landing page for a developer tooling product.',
      targetStack: 'vue3',
    },
    theme,
    styleBible,
    pages: [
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          {
            component: 'HeroSplit',
            props: {
              headline: 'Ship faster',
              subhead: 'Tooling that gets out of the way',
              primaryCta: { label: 'See pricing', to: '/pricing' },
            },
            content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
          },
          { component: 'StatsBand', props: { heading: 'By the numbers' } },
        ],
      },
      {
        route: '/about',
        title: 'About',
        pageType: 'landing',
        blocks: [
          { component: 'StatsBand', props: { heading: 'Our story' } },
          { component: 'TestimonialRow', props: { heading: 'What people say' } },
        ],
      },
      {
        route: '/pricing',
        title: 'Pricing',
        pageType: 'landing',
        blocks: [
          { component: 'HeroCentered', props: { headline: 'Pricing' } },
          { component: 'PricingCard', props: { heading: 'Pick a plan' } },
        ],
      },
    ],
  }
}

/** Replays a scripted sequence of drafts and records the prompts it was given. */
export class ScriptedDrafter implements SpecDrafter {
  readonly name = 'scripted'
  readonly requests: SpecDraftRequest[] = []
  private index = 0

  constructor(private readonly drafts: readonly unknown[]) {}

  async draft(request: SpecDraftRequest): Promise<unknown> {
    this.requests.push(request)
    const draft = this.drafts[Math.min(this.index, this.drafts.length - 1)]
    this.index += 1
    return draft
  }
}

/** Minimal 1x1 PNG so `vite build` has real bytes to copy into dist. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wFbnQvwAAAAAElFTkSuQmCC',
  'base64',
)

export class StubProvider implements ImageProvider {
  readonly name = 'stub'
  readonly requests: ImageRequest[] = []

  async generate(request: ImageRequest): Promise<Uint8Array> {
    this.requests.push(request)
    return new Uint8Array(ONE_PIXEL_PNG)
  }
}

/**
 * Fails during image generation, which runs after the workspace is allocated.
 * That is the only way to reach status 'failed' with the task directory still on
 * disk — exactly the state the source-export gate has to allow.
 */
export class FailingProvider implements ImageProvider {
  readonly name = 'failing'

  async generate(): Promise<Uint8Array> {
    throw new Error('image provider is down')
  }
}

/**
 * Holds the draft until the test releases the gate. The queue pumps
 * synchronously on enqueue, so an immediately-resolving drafter leaves no
 * observable window in which a task exists without a spec.
 */
export class GatedDrafter implements SpecDrafter {
  readonly name = 'gated'

  constructor(
    private readonly gate: Promise<void>,
    private readonly result: unknown,
  ) {}

  async draft(_request: SpecDraftRequest): Promise<unknown> {
    await this.gate
    return this.result
  }
}

/**
 * 放行前先卡住。`parkAt` 指的是第几次 `generate()` 调用被卡住 —— 之前的调用
 * 正常返回。`reached` 在那次调用进入后立刻 resolve，测试据此拿到一个确定的
 * 「前 k 张已落盘」观察窗口，而不是靠 sleep 猜。
 *
 * 断言之后**拒绝**闸门比放行便宜得多：任务停在图片阶段失败，整段 vite 构建
 * 就不必跑了。GatedDrafter 用的是同一个套路。
 */
export class GatedProvider implements ImageProvider {
  readonly name = 'gated'
  readonly requests: ImageRequest[] = []
  /** `generate()` 被进入 `parkAt` 次之后 resolve。 */
  readonly reached: Promise<void>

  private readonly gate: Promise<void>
  private readonly parkAt: number
  private markReached: () => void = () => {}

  constructor(gate: Promise<void>, parkAt = 1) {
    this.gate = gate
    this.parkAt = parkAt
    this.reached = new Promise((resolve) => {
      this.markReached = resolve
    })
  }

  async generate(request: ImageRequest): Promise<Uint8Array> {
    this.requests.push(request)
    if (this.requests.length >= this.parkAt) {
      this.markReached()
      await this.gate
    }
    return new Uint8Array(ONE_PIXEL_PNG)
  }
}
