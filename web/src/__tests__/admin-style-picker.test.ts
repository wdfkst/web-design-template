import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Antd from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TaskList from '../views/TaskList.vue'
import TaskDetail from '../views/TaskDetail.vue'

const ids = ['soft', 'warm', 'mist', 'porcelain', 'aurora']
const names = ['柔和立体', '温润自然', '雾色微光', '光瓷科技', '极光空间']
function manifest() {
  return { schemaVersion: 1, templateFingerprint: 'a'.repeat(64), styles: ids.map(id => ({ id, version: 1, entry: `${id}/1/index.html`, assetKind: ['porcelain', 'aurora'].includes(id) ? 'illustration' : 'ai-sample', files: ['index.html'] })) }
}
let wrappers: VueWrapper[] = []
let bodies: unknown[] = []
let manifestValue: unknown
let failCreate = false
let taskStyle: { id: string; version: number } | undefined
let requests: string[] = []
const task = () => ({ id: 'created', status: 'failed', description: '咖啡后台', createdAt: 1, adminStyle: taskStyle })
beforeEach(() => {
  bodies = []; requests = []; manifestValue = manifest(); failCreate = false; taskStyle = undefined
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    requests.push(input)
    if (input.endsWith('/manifest.json')) return new Response(JSON.stringify(manifestValue))
    if (input === '/tasks' && init?.method === 'POST') {
      bodies.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify(failCreate ? { error: '队列已满' } : task()), { status: failCreate ? 503 : 202 })
    }
    if (input === '/tasks') return new Response(JSON.stringify({ tasks: [] }))
    if (input.endsWith('/observability')) return new Response(JSON.stringify({ revision: 0, events: [], requests: [], eventsTruncated: false, requestsTruncated: false }))
    if (input.endsWith('/spec')) return new Response('{}', { status: 409 })
    return new Response(JSON.stringify(task()))
  }))
})
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers = []; vi.unstubAllGlobals(); document.body.innerHTML = '' })
async function screen(detail = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: TaskList }, { path: '/task/:id', component: TaskDetail }] })
  await router.push(detail ? '/task/created' : '/')
  const wrapper = mount(detail ? TaskDetail : TaskList, { attachTo: document.body, global: { plugins: [router, Antd], stubs: { GenerationArtwork: true, ATable: true } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
function button(wrapper: VueWrapper, text: string) { return wrapper.findAll('button').find(node => node.text() === text)! }
async function enable(wrapper: VueWrapper) { await wrapper.get('input[aria-label="启用后台风格"]').setValue(true); await flushPromises() }

describe('后台风格创建流程', () => {
  it('默认无选择，旧请求不携带风格', async () => {
    const wrapper = await screen()
    expect(wrapper.find('[aria-pressed="true"]').exists()).toBe(false)
    await wrapper.get('textarea').setValue('品牌网站')
    await button(wrapper, '开始生成').trigger('click'); await flushPromises()
    expect(bodies).toEqual([{ description: '品牌网站' }])
  })
  it('启用后必须选一套，关闭后恢复旧请求', async () => {
    const wrapper = await screen()
    await wrapper.get('textarea').setValue('咖啡后台'); await enable(wrapper)
    expect(button(wrapper, '开始生成').attributes('disabled')).toBeDefined()
    await wrapper.get('button[aria-label="选择柔和立体"]').trigger('click')
    await wrapper.get('input[aria-label="启用后台风格"]').setValue(false)
    await button(wrapper, '开始生成').trigger('click'); await flushPromises()
    expect(bodies).toEqual([{ description: '咖啡后台' }])
  })
  it.each(ids.map((id, i) => [id, names[i]]))('选择%s只提交ID，不提交版本', async (id, name) => {
    const wrapper = await screen()
    await wrapper.get('textarea').setValue('咖啡后台'); await enable(wrapper)
    await wrapper.get(`button[aria-label="选择${name}"]`).trigger('click')
    await button(wrapper, '开始生成').trigger('click'); await flushPromises()
    expect(bodies).toEqual([{ description: '咖啡后台', adminStyleId: id }])
  })
  it('提交失败仍保留已选风格与描述', async () => {
    failCreate = true
    const wrapper = await screen()
    await wrapper.get('textarea').setValue('咖啡后台'); await enable(wrapper)
    await wrapper.get('button[aria-label="选择温润自然"]').trigger('click')
    await button(wrapper, '开始生成').trigger('click'); await flushPromises()
    expect(wrapper.get('button[aria-label="选择温润自然"]').attributes('aria-pressed')).toBe('true')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('咖啡后台')
    expect(wrapper.text()).toContain('队列已满')
  })
  it.each([['soft', 1, '柔和立体'], ['future', 8, 'future']])('详情显示%s名称和快照版本', async (id, version, name) => {
    taskStyle = { id: String(id), version: Number(version) }
    const wrapper = await screen(true)
    expect(wrapper.get('[data-testid="task-admin-style"]').text()).toContain(`${name} · v${version}`)
  })
})

describe('隔离静态预览', () => {
  it('三页只切本地白名单，示意标记一直显示，浏览不创建任务', async () => {
    const wrapper = await screen(); await enable(wrapper)
    await wrapper.get('button[aria-label="预览光瓷科技"]').trigger('click'); await flushPromises()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('非 AI 成图')
    expect(dialog.get('iframe').attributes('sandbox')).toBe('allow-scripts')
    expect(dialog.get('iframe').attributes('src')).toMatch(/^\/admin-style-previews\/porcelain\/1\/index\.html\?previewSession=[^#]+#\/$/)
    await button(wrapper, '订单列表').trigger('click')
    expect(dialog.get('iframe').attributes('src')).toMatch(/^\/admin-style-previews\/porcelain\/1\/index\.html\?previewSession=[^#]+#\/orders$/)
    await button(wrapper, '商品编辑').trigger('click')
    expect(dialog.get('iframe').attributes('src')).toMatch(/^\/admin-style-previews\/porcelain\/1\/index\.html\?previewSession=[^#]+#\/products\/edit$/)
    await dialog.get('iframe').trigger('error')
    expect(dialog.text()).toContain('非 AI 成图')
    expect(dialog.get('[role="alert"]').text()).toContain('重试')
    expect(bodies).toEqual([])
    expect(requests.filter(path => path.includes('admin-style'))).toEqual(['/admin-style-previews/manifest.json'])
  })
  it('弹层限制Tab，Escape关闭并恢复触发按钮焦点', async () => {
    const wrapper = await screen(); await enable(wrapper)
    const opener = wrapper.get('button[aria-label="预览柔和立体"]')
    ;(opener.element as HTMLButtonElement).focus()
    await opener.trigger('click'); await flushPromises()
    const dialog = wrapper.get('[role="dialog"]')
    const close = dialog.get('button[aria-label="关闭预览"]')
    expect(document.activeElement).toBe(close.element)
    await close.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(dialog.element.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(close.element)
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(close.element)
    await dialog.trigger('keydown', { key: 'Escape' }); await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(opener.element)
  })
  it.each(['missing', 'version', 'entry', 'duplicate', 'kind', 'fingerprint'])('拒绝%s清单并可重试', async defect => {
    const value = manifest()
    if (defect === 'missing') value.styles.pop()
    if (defect === 'version') value.styles[0]!.version = 2
    if (defect === 'entry') value.styles[0]!.entry = 'https://example.com/evil'
    if (defect === 'duplicate') value.styles[1] = value.styles[0]!
    if (defect === 'kind') value.styles[3]!.assetKind = 'ai-sample'
    if (defect === 'fingerprint') value.templateFingerprint = ''
    manifestValue = value
    const wrapper = await screen(); await enable(wrapper)
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('pnpm build:admin-previews')
    manifestValue = manifest()
    await button(wrapper, '重试加载预览').trigger('click'); await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(bodies).toEqual([])
  })
})
