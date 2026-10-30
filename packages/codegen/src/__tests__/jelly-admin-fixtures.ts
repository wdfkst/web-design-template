import { derivePageAssets } from '@vudt/blocks'
import { finalizeSpec, ProjectSpecInputSchema } from '@vudt/spec'
import { personalizedAdminDraft } from './personalized-admin-fixtures.js'

export function jellyAdminSpec(name: 'maintenance' | 'media' | 'registration', motif?: 'spark' | 'bloom' | 'orbit' | 'toolkit', minimal = false) {
  const draft = personalizedAdminDraft(name)
  const palettes = { maintenance: ['#167369', '#78bca9', '#edbf5c'], media: ['#b53564', '#8aaee5', '#edbc65'], registration: ['#ad4534', '#77b8b1', '#e5be72'] }
  const colors = palettes[name]
  const pages = draft.pages.map(page => ({ ...page, title: page.title.split(' "')[0], blocks: minimal ? [] : page.blocks }))
  const derived = pages.map(page => derivePageAssets(page.route, page.blocks))
  return finalizeSpec(ProjectSpecInputSchema.parse({
    ...draft,
    theme: { ...draft.theme, mode: 'both', colorTokens: { ...draft.theme.colorTokens, primary: colors[0], secondary: colors[1], accent: colors[2] } },
    experience: { ...draft.experience, presentation: { ...draft.experience.presentation, appearance: 'jelly', decoration: minimal ? 'minimal' : 'balanced', motif: motif ?? { maintenance: 'toolkit', media: 'bloom', registration: 'spark' }[name] } },
    collections: draft.collections.map(collection => ({ ...collection, model: { ...collection.model, cover: { type: 'string', label: '封面' } } })),
    pages: pages.map((page, index) => ({ ...page, blocks: derived[index]!.blocks, admin: page.admin.mode === 'list' && name === 'media' ? { ...page.admin, card: { titleField: 'name', summaryFields: ['active'], coverField: 'cover' } } : page.admin })),
    assets: derived.flatMap(page => page.assets),
  }))
}

export const jellyCoverSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" rx="32" fill="#deedf4"/><circle cx="474" cy="92" r="70" fill="#edbc65"/><rect x="106" y="88" width="230" height="230" rx="58" fill="#b53564" transform="rotate(-9 220 200)"/><circle cx="248" cy="191" r="62" fill="#fce6d5"/><path d="M218 198q30 35 60 0" fill="none" stroke="#783249" stroke-width="10" stroke-linecap="round"/><circle cx="221" cy="173" r="6" fill="#783249"/><circle cx="272" cy="173" r="6" fill="#783249"/><rect x="363" y="229" width="170" height="74" rx="37" fill="#8aaee5"/></svg>'
