import { describe, expect, it } from 'vitest'
import { ServerError } from '../errors.js'
import { draftSpec } from '../spec-source.js'
import { ScriptedDrafter, landingDraft } from './fixture.js'

describe('draftSpec', () => {
  it('finalizes a valid draft on the first attempt', async () => {
    const drafter = new ScriptedDrafter([landingDraft()])
    const { spec, attempts } = await draftSpec(drafter, 'a landing page for Acme')

    expect(attempts).toBe(1)
    expect(drafter.requests).toHaveLength(1)
    expect(drafter.requests[0]?.feedback).toBeUndefined()
    // finalizeSpec is what derives the hashes the image cache keys on.
    expect(spec.assets.every((asset) => /^[0-9a-f]{16}$/.test(asset.contentHash))).toBe(true)
  })

  it('retries with the validator feedback appended to the request', async () => {
    const broken = { meta: { name: 'x' } }
    const drafter = new ScriptedDrafter([broken, landingDraft()])
    const { attempts } = await draftSpec(drafter, 'a landing page')

    expect(attempts).toBe(2)
    expect(drafter.requests).toHaveLength(2)
    const feedback = drafter.requests[1]?.feedback ?? ''
    // Path-prefixed lines are the whole point: the model needs to know where.
    expect(feedback).toMatch(/meta|theme|pages|assets/)
    expect(drafter.requests[1]?.attempt).toBe(2)
  })

  it('gives up after maxAttempts and reports the last feedback', async () => {
    const drafter = new ScriptedDrafter([{ nope: true }])
    await expect(draftSpec(drafter, 'anything', { maxAttempts: 2 })).rejects.toThrow(ServerError)
    expect(drafter.requests).toHaveLength(2)

    let caught: unknown
    try {
      await draftSpec(drafter, 'anything', { maxAttempts: 2 })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ServerError)
    const failure = caught as ServerError
    expect(failure.statusCode).toBe(422)
    expect(failure.detail).toBeTruthy()
  })

  it('rejects content for a slot the block does not declare, naming the legal ones', async () => {
    // The model can no longer send geometry, so the interesting failure moved:
    // an invented slot name is the shape mistake that still costs a retry.
    const draft = landingDraft() as { pages: { blocks: unknown[] }[] }
    // The prompt has to clear SlotContentSchema's minimum, and the page has to
    // clear the block minimum, or the shape check fails first and the slot name
    // is never looked up.
    draft.pages[0]!.blocks = [
      { component: 'HeroSplit', content: { banner: { prompt: 'anything' } } },
      { component: 'StatsBand' },
    ]

    let caught: unknown
    try {
      await draftSpec(new ScriptedDrafter([draft]), 'x', { maxAttempts: 1 })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ServerError)
    expect((caught as ServerError).detail).toMatch(/has no slot "banner"/)
  })

  it('rejects duplicate routes — the check derivation does not do', async () => {
    // Slotless blocks on purpose: with slots, the second page would collide on
    // asset ids first and this would stop proving gate 2 does anything. Three
    // pages because the draft contract demands a site, not a single page.
    const draft = landingDraft() as { pages: unknown[] }
    draft.pages = [
      { route: '/', title: 'Home', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      { route: '/', title: 'Home again', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
      { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: [{ component: 'StatsBand' }, { component: 'TestimonialRow' }] },
    ]

    let caught: unknown
    try {
      await draftSpec(new ScriptedDrafter([draft]), 'x', { maxAttempts: 1 })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ServerError)
    expect((caught as ServerError).detail).toMatch(/duplicate route/)
  })

  it('reports each attempt number before the model is asked', async () => {
    // Three junk drafts: every attempt is rejected, so all three are reported.
    const drafter = new ScriptedDrafter([{ garbage: true }])
    const seen: number[] = []

    await expect(
      draftSpec(drafter, 'a landing page', {
        maxAttempts: 3,
        onAttempt: (attempt) => seen.push(attempt),
      }),
    ).rejects.toThrow()

    expect(seen).toEqual([1, 2, 3])
    // One report per model call — the callback is not a progress bar of its own.
    expect(seen).toHaveLength(drafter.requests.length)
  })
})
