import { derivePageAssets, type BlockSelection } from '@vudt/blocks'
import { finalizeSpec, ProjectSpecInputSchema } from '@vudt/spec'
import { landingSpec } from './fixture.js'

type Scenario = 'maintenance' | 'media' | 'registration'

export function personalizedAdminDraft(name: Scenario) {
  const base = landingSpec()
  const minimal = name === 'registration'
  const media = name === 'media'
  const label = { maintenance: '设备维护', media: '素材目录', registration: '报名管理' }[name]
  const route = `/${name}`
  const form = `${name}-form`
  const blocks: BlockSelection[] = minimal ? [] : [{ component: 'AdminWelcomePanel', props: { headline: label, body: '管理当前记录' }, content: { illustration: { prompt: media ? 'a camera and image cards' : 'maintenance tools', alt: label } } }]
  return {
    meta: { ...base.meta, name: label },
    theme: { ...base.theme, colorTokens: { ...base.theme.colorTokens, primary: media ? '#7043a1' : '#176b68' } },
    styleBible: base.styleBible,
    experience: { kind: 'admin', presentation: { appearance: minimal ? 'plain' : 'soft-glass', decoration: minimal ? 'minimal' : 'balanced', density: 'comfortable', shell: media ? 'topbar' : 'sidebar' }, navigation: [{ id: 'home', label: '工作台', route: '/' }, { id: name, label, route }] },
    collections: [{ id: name, label, model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' }, active: { type: 'boolean', label: '启用' } }, fields: ['name', 'active'], seed: 12, actions: [] }],
    forms: [{ id: form, label, collection: name, fields: [{ key: 'name', label: '名称', type: 'string', required: true }, { key: 'active', label: '启用', type: 'boolean' }] }],
    pages: [
      { route: '/', title: '工作台', pageType: 'dashboard', blocks, admin: { mode: 'workbench', variant: name === 'maintenance' ? 'focus' : 'overview', ...(name === 'maintenance' ? { primaryModuleId: 'recent' } : {}), modules: [{ id: 'total', title: '记录总数', kind: 'summary', collection: name, metric: 'count' }, { id: 'recent', title: '当前记录', kind: 'records', collection: name, fields: ['name', 'active'], limit: 5, detailRoute: '/detail' }] } },
      { route, title: `${label} "引号"\n</script>`, pageType: 'list-detail', blocks: [], admin: { mode: 'list', variant: media ? 'cards' : 'table', ...(media ? { card: { titleField: 'name', summaryFields: ['active'] } } : {}), collection: name, form, filters: ['name', 'active'], columns: [{ field: 'name' }, { field: 'active', format: 'status' }], actions: [{ kind: 'create', label: '新增' }, { kind: 'edit', label: '编辑' }, { kind: 'detail', label: '详情', route: '/detail' }, { kind: 'delete', label: '删除' }, { kind: 'bulk-delete', label: '批量删除' }] } },
      { route: '/detail', title: '记录详情', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: name, returnRoute: route, variant: media ? 'aside' : 'sections', ...(media ? { asideFields: ['active'] } : {}) } },
      { route: '/create', title: '新建记录', pageType: 'form', blocks: [], admin: { mode: 'form', form, returnRoute: route, variant: name === 'maintenance' ? 'grouped' : 'single', ...(name === 'maintenance' ? { groups: [{ id: 'identity', title: '设备信息', fields: ['name'] }, { id: 'state', title: '运行状态', fields: ['active'] }] } : {}) } },
    ],
  }
}

function spec(name: Scenario) {
  const draft = personalizedAdminDraft(name)
  const derived = draft.pages.map(page => derivePageAssets(page.route, page.blocks))
  return finalizeSpec(ProjectSpecInputSchema.parse({ ...draft, pages: draft.pages.map((page, index) => ({ ...page, blocks: derived[index]!.blocks })), assets: derived.flatMap(page => page.assets) }))
}

export const personalizedAdminFixtures = {
  maintenance: () => spec('maintenance'),
  media: () => spec('media'),
  registration: () => spec('registration'),
}
