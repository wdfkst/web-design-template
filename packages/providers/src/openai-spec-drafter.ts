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
 * Blocks whose home is an app / back-office page. A management-system draft
 * picks from this group only, which is why the catalogue separates them from
 * the marketing blocks — the model should not have to scan marketing lines to
 * find what a back-office site uses.
 */
const APP_BLOCKS = new Set(['DataTable', 'EmptyStatePanel', 'FormPanel', 'StatsGrid', 'StatusCard', 'AuthPanel'])

/**
 * The block catalogue, rendered for the prompt in two groups — app blocks
 * (back-office / management systems) and marketing blocks. Only the fields the
 * model is allowed to influence are described as choices — the block's props
 * and the per-slot subject text; geometry is stated as off-limits, because it
 * comes from the sidecar and the code generator and the image generator both
 * read it from there.
 * Layout components are left out on purpose — see the loop below.
 */
function renderBlockCatalogue(): string {
  const lines: string[] = []
  let group: 'APP' | 'marketing' | null = null
  for (const component of [...BLOCK_REGISTRY.keys()].sort()) {
    const definition = BLOCK_REGISTRY.get(component)!
    // Nav and footer are project-level layout: the app shell renders them once
    // from the spec's own page list. Listing them would offer the model a block
    // that gate 1 rejects, burning a whole retry on a guaranteed failure.
    if (definition.layoutOnly === true) continue
    const nextGroup = APP_BLOCKS.has(component) ? 'APP' : 'marketing'
    if (nextGroup !== group) {
      lines.push(
        nextGroup === 'APP'
          ? 'APP blocks (back-office / management systems only):'
          : 'Marketing blocks (marketing sites only):',
      )
      group = nextGroup
    }
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
    'You are a front-end design agent. You design complete Vue 3 websites and web apps —',
    'marketing sites, back-office / management systems, dashboards, SaaS tools, portals —',
    'whatever the project description calls for — and output the whole site as a single',
    'JSON "draft" object. Reply with one JSON object only, no prose and no code fences.',
    '',
    'Design process (never output this — think it in your head before writing the JSON):',
    '- Step 1 — read the project description and decide what kind of site it is: a public',
    '  marketing site, an internal back-office / management system, or something else (a',
    '  tool, a portal, a showcase). The description decides the form; you do not. Read the',
    '  keywords (admin, dashboard, console, CRM, operations, "后台", "管理系统") and judge',
    '  from the whole description, not from one word.',
    '- Step 2 — plan the pages: list the pages a visitor needs, in the order the nav bar should',
    '  show them. Then, for each page, outline in 2-3 lines what it must communicate and who',
    '  it is for, and choose block components that actually serve that outline — the app',
    '  blocks for a management system, the marketing blocks for a marketing site.',
    '- Then fill copy that is concrete and brand-flavoured, not placeholder text.',
    '- Finally pick a theme that matches the site form you decided in step 1 (a back-office',
    '  system is not a marketing brochure — the rules below say what each form looks like).',
    '',
    'Site kind (decide from the project description first, then follow the matching section):',
    '',
    '1. Back-office / management system (admin, dashboard, console, CRM, operations,',
    '   "后台", "管理系统"):',
    '- Plan app pages and pick blocks from the "APP blocks" section only: DataTable,',
    '  FormPanel, StatsGrid, StatusCard, EmptyStatePanel, AuthPanel. Mark those pages',
    '  "dashboard", "settings", "list-detail" or "form" (auth pages "auth") — never',
    '  "landing", which switches the whole site to the marketing shell.',
    '- Theme is a management console, not a brochure: mode "light"; background a near-white',
    '  grey (#f5f6f8 or similar), surface pure white, foreground a dark slate; primary a',
    '  restrained hue — a desaturated blue, slate blue, or one brand colour — never a bright',
    '  saturated blue; radius "none" or "sm"; spacing "compact"; body font a clean sans',
    '  (Inter, system-ui). Density first: compact line height, small labels, hairline',
    '  dividers instead of big card shadows.',
    '- Do not: large rounded cards, drop shadows, gradient buttons, big marketing',
    '  illustrations, hype copy, decorative photography.',
    '',
    '2. Public marketing site:',
    '- Plan marketing pages and pick blocks from the "Marketing blocks" section; pick a',
    '  distinctive palette (do not default to a generic blue-grey), a font pair with',
    '  character, and a radius/spacing that match the page mood.',
    '',
    '3. Anything else (a tool, a portal, a showcase, an e-commerce catalogue):',
    '- Plan the pages that serve the product, pick the closest blocks, and match the theme',
    '  to the audience — a data tool reads like a console, a showcase reads like a marketing',
    '  site.',
    '',
    'Draft shape (send every key; only "props", "content", "operations",',
    ' "collections", and "forms" may be omitted):',
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
    '      ],',
    '      "operations": [ { "id": string, "label": string,',
    '        "kind": "refresh" | "route" | "export" | "filter",',
    '        "target": <a collection id or a route starting with "/">,',
    '        "param"?: string } ]  // optional',
    '    }',
    '  ]',
    '}',
    '',
    'Two more optional top-level keys of that same object:',
    '  "collections" (optional): [ { "id": "orders", "label": "订单",',
    '    "model": { "customer": { "type": "string", "label": "客户" },',
    '               "amount": { "type": "number", "label": "金额" },',
    '               "status": { "type": "enum", "label": "状态",',
    '                 "options": ["待处理", "已发货"] } },',
    '    "fields": ["customer", "amount", "status"],',
    '    "seed": 8, "actions": ["search", "edit", "delete", "export"] } ]',
    '  "forms" (optional): [ { "id": "order-form", "label": "新建订单",',
    '    "collection": "orders",',
    '    "fields": [ { "key": "customer", "label": "客户", "type": "string",',
    '      "required": true, "placeholder": "客户名称",',
    '      "validate": { "min": 1, "max": 40 } },',
    '                { "key": "email", "label": "邮箱", "type": "string",',
    '      "validate": { "pattern": "email" } } ],',
    '    "submit": { "label": "保存", "toast": "已保存" } } ]',
    '',
    'Data semantics (optional — only when the project needs it):',
    '- A back-office list page usually needs a collection: give the table a data model',
    '  (field types + seed rows) and it becomes searchable/sortable/pageable, not a',
    '  static snapshot. Give the collection actions it truly supports.',
    '- A settings/employee form usually needs a "forms" entry: a field may declare',
    '  "validate" as { "min": number, "max": number, "pattern": "email" } (each part',
    '  optional), not as a string. Static display fields stay fine without it.',
    '- "operations" on a page render a toolbar: "route" navigates to a declared route,',
    '  "refresh"/"export"/"filter" act on the target collection.',
    '- If the description does not call for live data, omit collections/forms entirely —',
    '  static blocks are fine for a marketing site.',
    '',
    'Available block components (grouped by use; NavBarSimple and FooterSimple are shell-level',
    'layout — see the rules), with the props and the only legal slot names for each:',
    renderBlockCatalogue(),
    '',
    'Rules:',
    '- Use only the components listed above, and only the props and slot names listed for that one.',
    '- Use the group that matches the site kind you decided in step 1: a management system uses',
    '  the "APP blocks" group, a marketing site uses the "Marketing blocks" group. Mixing a',
    '  marketing block into a back-office site (or an app block into a marketing site) reads wrong.',
    '- A prop\'s parenthesised shape is its exact key set: write "features": [{ "title": ...,',
    '  "body": ... }], never renamed fields.',
    '- You do not write asset ids, sizes or bindings. Every slot listed above is filled with an image',
    '  automatically: put your own subject text in "content", keyed by slot name. The geometry',
    '  (aspectRatio, renderSize, transparent, composition) comes from the component sidecar, not from',
    '  you.',
    '- "content" may be omitted, or list only the slots worth describing; the rest fall back to the',
    '  slot\'s own default. Never invent a slot name, and never send an "assets" key.',
    '- A block whose slots line says "none" takes no "content" key at all. Slot names are per-block:',
    '  read the slots list on that block\'s own line — CtaBanner\'s is "decoration", not',
    '  "illustration".',
    '- Plan a small site, not one page: 3-6 pages — a home page plus at least two inner pages a',
    '  visitor would actually want (pricing, about, docs, contact, sign in).',
    '- Give every page 2-5 content blocks — never fewer than 2, even on a short page. A sign-in',
    '  page pairs AuthPanel with a TestimonialRow; a contact page pairs FAQAccordion with a',
    '  CtaBanner.',
    '- "title" is short: 2-6 words. The nav bar uses it verbatim as the link text, and the first',
    '  auth page\'s title becomes the button at the end of the nav bar — so write the page names a',
    '  menu would show, not sentences.',
    '- Any prop named "to" is a destination inside this project: it must be the route of a page you',
    '  declared in "pages". Never write an anchor such as "#pricing" — an anchor cannot reach',
    '  another page.',
    '- NavBarSimple and FooterSimple are project-level layout, not page blocks: the platform renders',
    '  them once around every page, derived from your own page list. They are not in the catalogue',
    '  above, and must never appear in "pages".',
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
        // Some relays pass the model's answer through even when the model
        // wrapped it in markdown fences (the prompt forbids this, but the
        // schema gate would rather repair than lose the whole draft). Trim a
        // single enclosing ```lang ... ``` block, then retry the parse.
        const fenced = content.match(/^\s*```[^\n]*\n([\s\S]*?)\n```\s*$/)
        if (fenced) {
          try {
            return JSON.parse(fenced[1]!)
          } catch {
            // fall through
          }
        }
        return content
      }
    },
  }
}
