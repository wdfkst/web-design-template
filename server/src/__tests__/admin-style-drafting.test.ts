import { describe, expect, it, vi } from 'vitest'
import { draftSpec } from '../spec-source.js'
import { landingDraft, ScriptedDrafter } from './fixture.js'

const ref = { id: 'aurora', version: 1 } as const
function admin() {
  const base = landingDraft() as { meta: unknown; theme: unknown; styleBible: { seed: number } }
  return {
    ...structuredClone(base),
    experience: { kind: 'admin', navigation: [{ id: 'items', label: 'Items', route: '/' }] },
    collections: [{ id: 'items', label: 'Items', model: { id: { type: 'number', label: 'ID' }, name: { type: 'string', label: 'Name' } }, fields: ['name'], seed: 12, actions: [] }],
    forms: [{ id: 'item-form', label: 'Item', collection: 'items', fields: [{ key: 'name', label: 'Name', type: 'string' }] }],
    pages: [
      { route: '/', title: 'Items', pageType: 'list-detail', blocks: [], admin: { mode: 'list', collection: 'items', filters: ['name'], columns: [{ field: 'name' }], actions: [] } },
      { route: '/detail', title: 'Details', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: 'items', returnRoute: '/' } },
      { route: '/edit', title: 'Edit', pageType: 'form', blocks: [], admin: { mode: 'form', form: 'item-form', returnRoute: '/' } },
    ],
  }
}

describe('admin style drafting', () => {
  it('rejects valid marketing with feedback before accepting admin', async () => {
    const drafter = new ScriptedDrafter([landingDraft(), admin()])
    const states: string[] = []
    const { spec, attempts } = await draftSpec(drafter, 'coffee', {
      adminStyle: ref, onValidation: state => states.push(state),
    })
    expect(attempts).toBe(2)
    expect(drafter.requests[1]?.feedback).toMatch(/admin/)
    expect(states).toEqual(['started', 'failed', 'started', 'succeeded'])
    expect(spec.adminStyle).toEqual(ref)
    expect(spec.theme.mode).toBe('dark')
    expect(spec.styleBible.material).toBe('aurora-optical')
  })

  it('overrides conflicting style without modifying business data or the source', async () => {
    const raw = admin()
    const before = structuredClone(raw)
    const { spec: legacy } = await draftSpec(new ScriptedDrafter([raw]), 'coffee')
    const { spec } = await draftSpec(new ScriptedDrafter([raw]), 'coffee', { adminStyle: ref })
    expect(spec.theme.colorTokens.primary).toBe('#A7C6FF')
    expect(spec.experience).toMatchObject({ kind: 'admin', presentation: { shell: 'topbar' } })
    expect(spec.collections).toEqual(raw.collections)
    expect(spec.forms).toEqual(legacy.forms)
    expect(spec.pages.map(page => page.admin)).toEqual(legacy.pages.map(page => page.admin))
    expect(raw).toEqual(before)
  })

  it('preserves the original bad JSON validation feedback', async () => {
    const legacy = new ScriptedDrafter(['{bad json', landingDraft()])
    await draftSpec(legacy, 'coffee')
    const styled = new ScriptedDrafter(['{bad json', admin()])
    await draftSpec(styled, 'coffee', { adminStyle: ref })
    expect(styled.requests[1]?.feedback).toBe(legacy.requests[1]?.feedback)
    expect(styled.requests[1]?.adminStyle).toEqual(ref)
  })

  it('strips a model-claimed reference without changing the legacy theme', async () => {
    const raw = { ...(landingDraft() as object), adminStyle: ref }
    const { spec } = await draftSpec(new ScriptedDrafter([raw]), 'coffee')
    expect(spec.adminStyle).toBeUndefined()
    expect(spec.theme.colorTokens.primary).toBe('#4f46e5')
    expect(raw.adminStyle).toEqual(ref)
  })

  it('keeps the trusted reference and fallback seed across three attempts', async () => {
    const raw = admin()
    const withoutSeed = { ...raw, styleBible: { ...raw.styleBible, seed: -1 } }
    const broken = { ...withoutSeed, pages: [] }
    const drafter = new ScriptedDrafter([broken, broken, withoutSeed])
    const { spec, attempts } = await draftSpec(drafter, 'coffee', { adminStyle: ref, adminStyleSeed: 987 })
    expect(attempts).toBe(3)
    expect(drafter.requests.map(request => request.adminStyle)).toEqual([ref, ref, ref])
    expect(spec.styleBible.seed).toBe(987)
    expect(drafter.requests[1]?.feedback).not.toMatch(/seed/)
    expect(drafter.requests[2]?.feedback).not.toMatch(/seed/)
  })

  it('rejects unknown versions before calling the drafter or attempt observer', async () => {
    const drafter = new ScriptedDrafter([admin()])
    const onAttempt = vi.fn()
    await expect(draftSpec(drafter, 'coffee', {
      adminStyle: { id: 'aurora', version: 99 }, onAttempt,
    })).rejects.toThrow(/unsupported admin style/i)
    expect(drafter.requests).toHaveLength(0)
    expect(onAttempt).not.toHaveBeenCalled()
  })
})
