import type { EffectiveSettings } from './settings.js'

export const EXCERPT_LIMIT = 500

/** Deliberately free of `sk`/`Bearer` substrings so it cannot itself read as a key. */
export const REDACTION_PLACEHOLDER = '[redacted]'

export interface ProbeResult {
  ok: boolean
  status?: number
  bodyExcerpt?: string
  hint?: string
}

export interface ProbeReport {
  spec: ProbeResult
  image: ProbeResult
}

export interface ProbeKeys {
  specApiKey: string
  imageApiKey: string
}

/**
 * Redaction happens BEFORE the length cap on purpose: truncating first could cut a
 * key in half and leave a usable fragment sitting at the boundary. Only the two
 * literal values we were handed are scrubbed — no `Bearer`/`sk-` pattern guessing,
 * which would mangle legitimate relay diagnostics and give false confidence about
 * key formats we did not anticipate. An empty key is skipped, since splitting on
 * '' would otherwise replace every position in the body.
 */
function excerpt(raw: string, secrets: readonly string[]): string {
  let scrubbed = raw.trim()
  for (const secret of secrets) {
    if (secret === '') continue
    scrubbed = scrubbed.split(secret).join(REDACTION_PLACEHOLDER)
  }
  return scrubbed.length > EXCERPT_LIMIT ? scrubbed.slice(0, EXCERPT_LIMIT) : scrubbed
}

/**
 * Both providers deliberately throw status-only errors, because their error paths
 * carry a prompt and a key. This probe may echo the body instead: the request it
 * sends is synthetic, and the key travels in a header that is never reflected.
 */
function hintFor(status: number, body: string): string | undefined {
  if (status === 401 || status === 403) {
    return 'The relay rejected the credentials. Check VUDT_SPEC_API_KEY / VUDT_IMAGE_API_KEY.'
  }
  if (status === 404) {
    return 'Endpoint not found. Check the base URL includes the version path, e.g. /v1.'
  }
  if (status === 400 && /response_format/i.test(body)) {
    return 'This relay rejects response_format. Turn off the JSON response format switch.'
  }
  if (status === 400 && /model/i.test(body)) {
    return 'The relay did not accept this model name. Check the exact spelling it expects.'
  }
  return undefined
}

async function attempt(
  run: () => Promise<Response>,
  secrets: readonly string[],
): Promise<ProbeResult> {
  let response: Response
  try {
    response = await run()
  } catch (error) {
    // A transport failure has no status; the message is the only diagnostic. It goes
    // through the same redaction as a response body, so this path is safe by
    // construction rather than by the key merely happening to stay out of the URL.
    return {
      ok: false,
      bodyExcerpt: excerpt(error instanceof Error ? error.message : String(error), secrets),
    }
  }

  if (response.ok) return { ok: true, status: response.status }

  const body = excerpt(await response.text().catch(() => ''), secrets)
  const hint = hintFor(response.status, body)
  return {
    ok: false,
    status: response.status,
    ...(body === '' ? {} : { bodyExcerpt: body }),
    ...(hint === undefined ? {} : { hint }),
  }
}
export async function probeSettings(
  settings: EffectiveSettings,
  keys: ProbeKeys,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeReport> {
  // Users paste relay URLs off a dashboard, and those routinely carry a trailing
  // slash; left in, it yields `//chat/completions`, which some relays 404. The probe
  // would then report failure for a config that actually works. Matches the
  // `.replace(/\/+$/, '')` in packages/providers/src/openai-spec-drafter.ts.
  const specBaseUrl = settings.spec.baseUrl.replace(/\/+$/, '')
  const imageBaseUrl = settings.image.baseUrl.replace(/\/+$/, '')
  const secrets = [keys.specApiKey, keys.imageApiKey]

  // Each side is awaited independently so one failure cannot mask the other.
  const spec = await attempt(() =>
    fetchImpl(`${specBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${keys.specApiKey}`,
      },
      body: JSON.stringify({
        model: settings.spec.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        ...(settings.spec.sendResponseFormat ? { response_format: { type: 'json_object' } } : {}),
      }),
    }),
    secrets,
  )

  // Listing models rather than generating one: an image costs money and seconds,
  // and the address plus credentials are what this button exists to verify.
  const image = await attempt(
    () =>
      fetchImpl(`${imageBaseUrl}/models`, {
        headers: { authorization: `Bearer ${keys.imageApiKey}` },
      }),
    secrets,
  )

  return { spec, image }
}
