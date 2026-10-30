export const adminExample = {
  meta: { name: '业务管理', description: '可扩展的业务后台', targetStack: 'vue3' },
  experience: { kind: 'admin', presentation: { appearance: 'jelly', motif: 'toolkit', decoration: 'balanced', density: 'comfortable', shell: 'sidebar' }, navigation: [{ id: 'home', label: '工作台', icon: 'grid', route: '/' }, { id: 'items', label: '记录管理', icon: 'box', route: '/items' }] },
  theme: { colorTokens: { primary: '#7043a1', secondary: '#426877', accent: '#b56a21', background: '#f4f5f8', surface: '#ffffff', foreground: '#202835', muted: '#586473' }, radius: 'md', spacing: 'compact', fontPair: { heading: 'system-ui', body: 'system-ui' }, mode: 'light' },
  styleBible: { artStyle: 'flat-vector', lineWeight: 'thin', shading: 'flat', perspective: 'front', palette: ['#7043a1', '#426877'], backgroundTreatment: 'solid', negativePrompt: 'no text, no watermark', seed: 42 },
  collections: [{ id: 'items', label: '业务记录', model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' }, active: { type: 'boolean', label: '启用' } }, fields: ['name', 'active'], seed: 12, actions: [] }],
  forms: [{ id: 'item-form', label: '记录', collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string', required: true }, { key: 'active', label: '启用', type: 'boolean' }] }],
  pages: [
    { route: '/', title: '工作台', pageType: 'dashboard', blocks: [], admin: { mode: 'workbench', variant: 'overview', modules: [{ id: 'total', title: '记录总数', kind: 'summary', collection: 'items', metric: 'count' }, { id: 'active', title: '启用分布', kind: 'breakdown', collection: 'items', field: 'active' }, { id: 'recent', title: '业务记录', kind: 'records', collection: 'items', fields: ['name', 'active'], limit: 5, detailRoute: '/detail' }, { id: 'links', title: '快捷入口', kind: 'shortcuts', routes: ['/items'] }] } },
    { route: '/items', title: '记录管理', pageType: 'list-detail', blocks: [], admin: { mode: 'list', collection: 'items', form: 'item-form', filters: ['name', 'active'], columns: [{ field: 'name' }, { field: 'active', format: 'status' }], actions: [{ kind: 'create', label: '新增' }, { kind: 'edit', label: '编辑' }, { kind: 'detail', label: '详情', route: '/detail' }, { kind: 'delete', label: '删除' }] } },
    { route: '/detail', title: '记录详情', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: 'items', returnRoute: '/items' } },
  ],
}
