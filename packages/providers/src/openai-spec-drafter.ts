import { BLOCK_REGISTRY } from '@vudt/blocks'

export interface SpecDraftRequest {
  description: string
  /** Validation feedback from the previous attempt, appended as its own turn. */
  feedback?: string
  attempt: number
}

/**
 * Structurally identical to the server's `SpecDrafter`. Declared here rather
 * than imported so this package does not depend on the HTTP layer.
 */
export interface SpecDrafter {
  readonly name: string
  draft(request: SpecDraftRequest): Promise<unknown>
}

export interface OpenAISpecDrafterOptions {
  apiKey: string
  model: string
  baseUrl?: string
  fetch?: typeof fetch
  temperature?: number
  /**
   * Some OpenAI-compatible relays reject `response_format` with a 400. Turning it
   * off is safe: the reply is parsed leniently and falls back to the raw string.
   */
  sendResponseFormat?: boolean
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/**
 * The block catalogue, rendered for the prompt. Only the fields the model is
 * allowed to influence are described as choices — the block's props and the
 * per-slot subject text; geometry is stated as off-limits, because it comes from
 * the sidecar and the code generator and the image generator both read it from
 * there.
 */
function renderBlockCatalogue(): string {
  const lines: string[] = []
  for (const component of [...BLOCK_REGISTRY.keys()].sort()) {
    const definition = BLOCK_REGISTRY.get(component)!
    const pageTypes = definition.pageTypes.join(', ')
    const props = Object.entries(definition.props)
      .map(([name, shape]) => `${name} (${shape})`)
      .join(', ')
    const slots = definition.slots
      .map((slot) => `${slot.name} (${slot.purpose}, ${slot.aspectRatio})`)
      .join('; ')
    lines.push(
      `- ${component} [pages: ${pageTypes}] props: ${props === '' ? 'none' : props}` +
        ` | slots: ${slots === '' ? 'none' : slots}`,
    )
  }
  return lines.join('\n')
}

function systemPrompt(): string {
  return [
    'You design Vue 3 marketing and app pages as a single JSON "draft" object.',
    'Reply with one JSON object only, no prose and no code fences.',
    '',
    'Design process (never output this — think it in your head before writing the JSON):',
    '- For each page, first outline in 2-3 lines what the page must communicate, who it is for,',
    '  and in what order the sections should appear. Choose block components that actually',
    '  serve that outline.',
    '- Then fill copy that is concrete and brand-flavoured, not placeholder text.',
    '- Pick a theme with a distinctive palette (do not default to a generic blue-grey), a',
    '  font pair with character, and radius/spacing/mode that match the page mood.',
    '',
    'Draft shape (send every key; only "props" and "content" may be omitted):',
    '{',
    '  "meta": { "name": string, "description": string, "targetStack": "vue3" },',
    '  "theme": {',
    '    "colorTokens": { "primary": hex, "secondary": hex, "accent": hex,',
    '      "background": hex, "surface": hex, "foreground": hex, "muted": hex },',
    '    "radius": "none" | "sm" | "md" | "lg" | "full",',
    '    "spacing": "compact" | "normal" | "relaxed",',
    '    "fontPair": { "heading": string, "body": string },',
    '    "mode": "light" | "dark" | "both"',
    '  },',
    '  "styleBible": {',
    '    "artStyle": "flat-vector" | "isometric" | "hand-drawn" | "gradient-mesh" | "3d-clay" | "line-art" | "paper-cut",',
    '    "lineWeight": "none" | "thin" | "medium" | "bold",',
    '    "shading": "none" | "flat" | "soft-gradient" | "dramatic",',
    '    "perspective": "front" | "isometric" | "top-down" | "three-quarter",',
    '    "palette": array of 2-8 hex colors,',
    '    "backgroundTreatment": "solid" | "subtle-gradient" | "scene" | "abstract-shapes",',
    '    "negativePrompt": string (may be empty),',
    '    "seed": non-negative integer',
    '  },',
    '  "pages": [',
    '    {',
    '      "route": "/" or "/pricing" (lowercase, unique, starts with "/"),',
    '      "title": string,',
    '      "pageType": "landing" | "dashboard" | "form" | "list-detail" | "auth" | "settings",',
    '      "blocks": [',
    '        { "component": <a component listed below>,',
    '          "props": { <the copy for that block, see its props below> },',
    '          "content": { "illustration": { "prompt": string, "alt": string } } }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'Available block components, with the props and the only legal slot names for each:',
    renderBlockCatalogue(),
    '',
    'Rules:',
    '- Use only the components listed above, and only the props and slot names listed for that one.',
    '- A prop\'s parenthesised shape is its exact key set: write "features": [{ "title": ...,',
    '  "body": ... }], never renamed fields.',
    '- You do not write asset ids, sizes or bindings. Every slot listed above is filled with an image',
    '  automatically: put your own subject text in "content", keyed by slot name. The geometry',
    '  (aspectRatio, renderSize, transparent, composition) comes from the component sidecar, not from',
    '  you.',
    '- "content" may be omitted, or list only the slots worth describing; the rest fall back to the',
    '  slot\'s own default. Never invent a slot name, and never send an "assets" key.',
    '- Keep the page count and the block count small: 1-3 pages, 2-5 blocks per page. Every slot you',
    '  use costs one image, so prefer a few well-chosen sections over a long page.',
    '- Routes must be unique and start with "/". targetStack is always "vue3".',
  ].join('\n')
}

function userPrompt(description: string): string {
  return `Project description:\n${description}`
}

function feedbackPrompt(feedback: string): string {
  return [
    'Your previous JSON failed validation. Fix exactly these problems and reply with the full',
    'corrected JSON object:',
    feedback,
  ].join('\n')
}

interface ChatCompletionReply {
  choices?: { message?: { content?: string | null } }[]
}

/**
 * A `SpecDrafter` backed by any OpenAI-compatible `/chat/completions` endpoint.
 *
 * The retry loop lives in the server's `draftSpec()`, so this only has to turn
 * one request into one reply. Unparseable content is returned as the raw string
 * rather than thrown: the spec schema is the single validator, and handing it
 * the garbage produces the path-prefixed feedback that makes the retry useful.
 */
export function createOpenAISpecDrafter(options: OpenAISpecDrafterOptions): SpecDrafter {
  const { apiKey, model } = options
  if (apiKey.trim() === '') throw new Error('createOpenAISpecDrafter: apiKey is required')
  if (model.trim() === '') throw new Error('createOpenAISpecDrafter: model is required')

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const fetchImpl = options.fetch ?? globalThis.fetch
  const system = systemPrompt()

  return {
    name: `openai:${model}`,
    async draft(request: SpecDraftRequest): Promise<unknown> {
      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt(request.description) },
      ]
      if (request.feedback !== undefined && request.feedback.trim() !== '') {
        messages.push({ role: 'user', content: feedbackPrompt(request.feedback) })
      }

      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          ...(options.sendResponseFormat === false ? {} : { response_format: { type: 'json_object' } }),
          temperature: options.temperature ?? 0.4,
        }),
      })

      if (!response.ok) {
        // The body can echo request details; the status is what a caller can act
        // on, and it cannot contain the key.
        throw new Error(`spec drafter request failed with status ${response.status}`)
      }

      const reply = (await response.json()) as ChatCompletionReply
      const content = reply.choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('spec drafter reply carried no content')
      }

      try {
        return JSON.parse(content)
      } catch {
        return content
      }
    },
  }
}
