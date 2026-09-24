import { describe, expect, test } from 'vitest'
import { BLOCK_REGISTRY } from '@vudt/blocks'
import { PageTypeSchema, StyleBibleSchema, ThemeSchema } from '@vudt/spec'
import { createOpenAISpecDrafter } from '../openai-spec-drafter.js'

interface Capture {
  url: string
  init: RequestInit
  body: {
    model: string
    messages: { role: string; content: string }[]
    response_format?: { type: string }
  }
}

function recordingFetch(responseBody: unknown, status = 200) {
  const calls: Capture[] = []
  const fetchImpl = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(url),
      init: init ?? {},
      body: JSON.parse(String(init?.body)),
    })
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { calls, fetchImpl }
}

function chatReply(content: string): unknown {
  return { choices: [{ message: { role: 'assistant', content } }] }
}

function drafterWith(
  responseBody: unknown,
  status = 200,
  extra: { sendResponseFormat?: boolean } = {},
) {
  const { calls, fetchImpl } = recordingFetch(responseBody, status)
  const drafter = createOpenAISpecDrafter({
    apiKey: 'sk-test',
    model: 'gpt-test',
    baseUrl: 'https://example.invalid/v1',
    fetch: fetchImpl as unknown as typeof fetch,
    ...extra,
  })
  return { calls, drafter }
}

function systemOf(call: Capture): string {
  return call.body.messages.find((m) => m.role === 'system')!.content
}

/**
 * Every enum the spec schema accepts, read from the schema rather than retyped,
 * so a value added to the schema cannot silently stay undocumented.
 */
function schemaEnumValues(): string[] {
  const enums: (readonly string[])[] = [
    ThemeSchema.shape.mode.options,
    ThemeSchema.shape.radius.options,
    ThemeSchema.shape.spacing.options,
    StyleBibleSchema.shape.artStyle.options,
    StyleBibleSchema.shape.lineWeight.options,
    StyleBibleSchema.shape.shading.options,
    StyleBibleSchema.shape.perspective.options,
    StyleBibleSchema.shape.backgroundTreatment.options,
    PageTypeSchema.options,
  ]
  return enums.flat()
}

describe('createOpenAISpecDrafter', () => {
  test('returns the parsed JSON object the model emitted', async () => {
    const spec = { meta: { name: 'Acme', description: 'x', targetStack: 'vue3' } }
    const { drafter } = drafterWith(chatReply(JSON.stringify(spec)))

    const raw = await drafter.draft({ description: 'a landing page', attempt: 1 })

    expect(raw).toEqual(spec)
  })

  test('names itself after the model so task records say what drafted the spec', () => {
    const { drafter } = drafterWith(chatReply('{}'))

    expect(drafter.name).toBe('openai:gpt-test')
  })

  test('posts to the chat completions path under the configured base url', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    expect(calls[0]!.url).toBe('https://example.invalid/v1/chat/completions')
    expect(calls[0]!.init.method).toBe('POST')
  })

  test('sends the api key as a bearer token', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const headers = new Headers(calls[0]!.init.headers)
    expect(headers.get('authorization')).toBe('Bearer sk-test')
  })

  test('asks for json object output so the reply is parseable without repair', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    expect(calls[0]!.body.response_format).toEqual({ type: 'json_object' })
  })

  test('lists every content block in the catalogue and no layout component', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    for (const definition of BLOCK_REGISTRY.values()) {
      const listed = new RegExp(`^- ${definition.component} \\[pages: `, 'm').test(system)
      // Nav and footer are rendered once by the shell, so offering them here
      // would invite the model to put a second one inside a page.
      expect(listed, `${definition.component} layoutOnly=${definition.layoutOnly}`).toBe(
        definition.layoutOnly !== true,
      )
    }
  })

  test('lists the legal slot names for each block so bindings cannot be invented', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = calls[0]!.body.messages.find((m) => m.role === 'system')!.content
    expect(system).toMatch(/HeroSplit[^\n]*illustration/)
  })

  test('documents each block\'s props from the sidecar so copy lands in the right keys', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    // Props are validated as `unknown`, so a wrong key is not an error — it just
    // renders nothing. The prompt is the only place the model can learn them.
    expect(system).toMatch(/HeroSplit[^\n]*headline \(string\)[^\n]*secondaryCta/)
    expect(system).toMatch(/FeatureTriad[^\n]*features \(\{ title, body \}\[\]\)/)
  })

  test('tells the model geometry comes from the sidecar, not from it', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = calls[0]!.body.messages.find((m) => m.role === 'system')!.content
    expect(system).toMatch(/renderSize/)
    expect(system).toMatch(/aspectRatio/)
  })

  test('documents every value the spec schema accepts as an enum', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    // A model that cannot see the legal values guesses them, and three retries
    // are not enough to converge on eight undocumented enums.
    const missing = schemaEnumValues().filter((value) => !system.includes(value))
    expect(missing).toEqual([])
  })

  test('names every key the model has to emit', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    const keys = [
      'meta',
      'name',
      'description',
      'targetStack',
      'theme',
      'colorTokens',
      'primary',
      'secondary',
      'accent',
      'background',
      'surface',
      'foreground',
      'muted',
      'radius',
      'spacing',
      'fontPair',
      'heading',
      'body',
      'mode',
      'styleBible',
      'artStyle',
      'lineWeight',
      'shading',
      'perspective',
      'palette',
      'backgroundTreatment',
      'negativePrompt',
      'seed',
      'pages',
      'route',
      'title',
      'pageType',
      'blocks',
      'component',
      'props',
      'content',
      'prompt',
      'alt',
    ]
    const missing = keys.filter((key) => !new RegExp(`\\b${key}\\b`).test(system))
    expect(missing).toEqual([])
  })

  test('puts the user description in the user message', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a pricing page for a coffee roaster', attempt: 1 })

    const user = calls[0]!.body.messages.filter((m) => m.role === 'user')
    expect(user.some((m) => m.content.includes('a pricing page for a coffee roaster'))).toBe(true)
  })

  test('feeds validation feedback back as a user message on a retry', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({
      description: 'a landing page',
      feedback: 'assets.0.renderSize: does not match aspectRatio 4:3',
      attempt: 2,
    })

    const joined = calls[0]!.body.messages.map((m) => m.content).join('\n')
    expect(joined).toContain('assets.0.renderSize: does not match aspectRatio 4:3')
  })

  test('omits the feedback message on the first attempt', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    expect(calls[0]!.body.messages).toHaveLength(2)
  })

  test('throws with the status when the endpoint rejects the call', async () => {
    const { drafter } = drafterWith({ error: { message: 'bad key' } }, 401)

    await expect(drafter.draft({ description: 'x', attempt: 1 })).rejects.toThrow(/401/)
  })

  test('throws when the reply carries no assistant content', async () => {
    const { drafter } = drafterWith({ choices: [] })

    await expect(drafter.draft({ description: 'x', attempt: 1 })).rejects.toThrow(/no content/i)
  })

  test('returns the raw string when the content is not valid json', async () => {
    const { drafter } = drafterWith(chatReply('sorry, I cannot do that'))

    const raw = await drafter.draft({ description: 'x', attempt: 1 })

    expect(raw).toBe('sorry, I cannot do that')
  })

  test('unwraps a markdown-fenced json block a relay may pass through', async () => {
    const payload = { meta: { name: 'Acme', description: 'x', targetStack: 'vue3' } }
    const { drafter } = drafterWith(chatReply("```json\n" + JSON.stringify(payload) + "\n```"))

    const raw = await drafter.draft({ description: 'x', attempt: 1 })

    expect(raw).toEqual(payload)
  })

  test('still returns the raw string when fenced content is not json', async () => {
    const { drafter } = drafterWith(chatReply('```json\nnot really json\n```'))

    const raw = await drafter.draft({ description: 'x', attempt: 1 })

    expect(raw).toBe('```json\nnot really json\n```')
  })

  test('does not leak the api key into the thrown message', async () => {
    const { drafter } = drafterWith({ error: { message: 'bad key' } }, 401)

    await expect(drafter.draft({ description: 'x', attempt: 1 })).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('sk-test') }),
    )
  })

  test('omits response_format when sendResponseFormat is false', async () => {
    const { calls, drafter } = drafterWith(chatReply('{"ok":true}'), 200, {
      sendResponseFormat: false,
    })
    await drafter.draft({ description: 'a landing page', attempt: 1 })
    expect(calls[0]!.body.response_format).toBeUndefined()
  })

  test('sends response_format by default', async () => {
    const { calls, drafter } = drafterWith(chatReply('{"ok":true}'))
    await drafter.draft({ description: 'a landing page', attempt: 1 })
    expect(calls[0]!.body.response_format).toEqual({ type: 'json_object' })
  })

  test('asks the model to plan an outline before writing the draft', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/outline/i)
    expect(system).toMatch(/design process/i)
    expect(system).toMatch(/brand-flavoured/i)
  })

  test('guides the theme by site kind in the system prompt', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a management system', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/back-office or management system/i)
    expect(system).toMatch(/DataTable/)
    expect(system).toMatch(/restrained/)
  })

  test('asks for a small site rather than a single page', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/3-6 pages/)
    expect(system).toMatch(/at least two inner pages|home page plus/i)
    // The line that used to talk the model out of a second page.
    expect(system).not.toContain('Keep the page count')
    expect(system).not.toContain('prefer a few well-chosen sections')
  })

  test('constrains titles, because the nav bar reuses them verbatim', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/2-6 words/)
    expect(system).toMatch(/nav bar/i)
  })

  test('documents the to-is-a-route convention', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    expect(system).toMatch(/prop named "to"/)
    expect(system).toMatch(/never write an anchor|#pricing/i)
  })

  // A draft that is not a site never reaches gate 1, so the prompt has to say so
  // before the model spends a whole turn on one page.
  test('states the page and block minimums the draft schema enforces', async () => {
    const { calls, drafter } = drafterWith(chatReply('{}'))

    await drafter.draft({ description: 'a landing page', attempt: 1 })

    const system = systemOf(calls[0]!)
    // The page floor is the invariant this whole task exists to reinforce, so it
    // gets a guard here rather than only in the "asks for a small site" test.
    expect(system).toMatch(/3-6 pages/)
    expect(system).toMatch(/2-5 content blocks/)
    // The natural sign-in page is a single AuthPanel, which the draft schema
    // rejects; the floor has to be stated as a floor, or the model keeps
    // spending its retries discovering that.
    expect(system).toMatch(/never fewer than 2/)
    // A slot name belongs to one block. The model kept handing CtaBanner the
    // "illustration" slot that HeroSplit owns instead of its own "decoration".
    expect(system).toMatch(/CtaBanner's is "decoration"/)
  })
})
