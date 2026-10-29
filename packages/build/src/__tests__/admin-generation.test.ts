import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { expect, it } from 'vitest'
import { deriveSpecInput } from '@vudt/blocks'
import { finalizeSpec, ProjectSpecInputSchema } from '@vudt/spec'
import { buildTask } from '../pipeline.js'
import { WorkspaceRoot } from '../workspace.js'
import { landingSpec } from './fixture.js'

for (const [label, primary] of [['库存商品', '#087f75'], ['维修工单', '#985a18']] as const) {
  it(`builds all admin modes from a derived ${label} draft`, async () => {
    const base = landingSpec()
    const draft = {
      meta: { ...base.meta, name: label }, theme: { ...base.theme, colorTokens: { ...base.theme.colorTokens, primary } }, styleBible: base.styleBible,
      experience: { kind: 'admin', navigation: [{ id: 'home', label: '工作台', route: '/' }, { id: 'items', label, route: '/items' }] },
      collections: [{ id: 'items', label, model: { id: { type: 'number', label: '编号' }, name: { type: 'string', label: '名称' }, active: { type: 'boolean', label: '启用' } }, fields: ['name', 'active'], seed: 3, actions: [] }],
      forms: [{ id: 'item', label, collection: 'items', fields: [{ key: 'name', label: '名称', type: 'string', required: true }] }, { id: 'settings', label: '偏好', fields: [{ key: 'title', label: '标题', type: 'string' }] }],
      pages: [
        { route: '/', title: '工作台', pageType: 'dashboard', blocks: [], admin: { mode: 'workbench', collections: ['items'], shortcuts: ['/items'] } },
        { route: '/items', title: label, pageType: 'list-detail', blocks: [], admin: { mode: 'list', collection: 'items', form: 'item', filters: ['name', 'active'], columns: [{ field: 'name' }, { field: 'active', format: 'status' }], actions: [{ kind: 'create', label: '新增' }, { kind: 'edit', label: '编辑' }, { kind: 'detail', label: '详情', route: '/detail' }, { kind: 'set-field', label: '停用', field: 'active', value: false }] } },
        { route: '/detail', title: '详情', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: 'items', returnRoute: '/items' } },
        { route: '/form', title: '新增', pageType: 'form', blocks: [], admin: { mode: 'form', form: 'item', returnRoute: '/items' } },
        { route: '/settings', title: '设置', pageType: 'settings', blocks: [], admin: { mode: 'settings', form: 'settings', returnRoute: '/' } },
      ],
    }
    if (label === '维修工单') {
      Object.assign(draft.collections[0]!.model, {
        priority: { type: 'enum', label: '优先级', options: ['普通', '紧急'] },
        dueDate: { type: 'date', label: '计划日期' },
        estimate: { type: 'number', label: '预计费用' },
      })
      draft.collections[0]!.fields.push('priority', 'dueDate', 'estimate')
      draft.forms[0]!.fields.push(
        { key: 'priority', label: '优先级', type: 'enum', required: true },
        { key: 'dueDate', label: '计划日期', type: 'date', required: true },
        { key: 'estimate', label: '预计费用', type: 'number', required: true },
      )
      const list = draft.pages[1]!.admin
      list.filters!.push('priority')
      list.columns!.push({ field: 'priority', format: 'status' }, { field: 'dueDate', format: 'date' }, { field: 'estimate', format: 'currency' })
    }
    if (label === '维修工单') Object.assign(draft.pages[1]!, { blocks: [{ component: 'EmptyStatePanel', props: { headline: '暂无维修工单', body: '新增工单后开始处理。' }, content: { illustration: { prompt: 'empty maintenance tray', alt: '空维修托盘' } } }] })
    const derived = deriveSpecInput(draft)
    if (!derived.ok) throw new Error(derived.feedback)
    const spec = finalizeSpec(ProjectSpecInputSchema.parse(derived.value))
    const dir = await mkdtemp(join(tmpdir(), 'vudt-admin-e2e-'))
    try {
      const result = await buildTask(spec, { workspace: await new WorkspaceRoot(dir).allocate('admin'), templateDir: resolve(__dirname, '../../../templates/vue3-base'), adminTemplateDir: resolve(__dirname, '../../../templates/vue3-admin'), provider: { name: 'test-image', async generate() { if (label === '库存商品') throw new Error('Unexpected image request'); return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAABzenr0AAAADUlEQVR42mNkYGD4DwABBAEAX+XkhQAAAABJRU5ErkJggg==', 'base64') } } }).catch(error => { throw new Error(`${error.message}\n${JSON.stringify(error.detail)}`) })
      expect(result.build.code).toBe(0)
      if (label === '维修工单') {
        expect(result.write.expectedAssets).toHaveLength(1)
        const asset = result.write.expectedAssets[0]!
        expect((await readFile(join(result.distDir, asset.path.replace(/^public\//, '')))).length).toBeGreaterThan(0)
        expect(await readFile(join(result.projectDir, 'src/modules/ItemsPage/config.ts'), 'utf8')).toContain('空维修托盘')
      }
      expect(await readFile(join(result.projectDir, 'README.md'), 'utf8')).toContain('刷新')
      expect(await readFile(join(result.projectDir, 'src/theme/generated.css'), 'utf8')).toContain(primary)
    } finally { await rm(dir, { recursive: true, force: true }) }
  }, 180_000)
}
