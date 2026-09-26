import { describe, expect, it } from 'vitest'
import { getSlot } from '@vudt/blocks'
import type { ProjectSpec } from '@vudt/spec'
import { CodegenError } from '../errors.js'
import { renderPage } from '../page.js'
import { dataModelSpec, landingSpec } from './fixture.js'

function homePage(spec: ProjectSpec) {
  return spec.pages.find((page) => page.route === '/')!
}

describe('renderPage', () => {
  it('imports each distinct block component exactly once', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const imports = [...sfc.matchAll(/^import (\w+) from '\.\.\/blocks\/(\w+)\.vue'$/gm)]
    const names = imports.map((m) => m[1])
    expect(names).toEqual(['CtaBanner', 'FeatureTriad', 'HeroSplit', 'StatsBand'])
    expect(new Set(names).size).toBe(names.length)
  })

  it('emits one tag per block, in spec order', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const template = sfc.slice(sfc.indexOf('<template>'))
    const order = [...template.matchAll(/<([A-Z]\w+)/g)].map((m) => m[1])
    expect(order).toEqual(['HeroSplit', 'StatsBand', 'FeatureTriad', 'CtaBanner'])
  })

  it('takes w/h from the sidecar, not from the manifest entry', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const slot = getSlot('HeroSplit', 'illustration')!
    expect(sfc).toContain(`w: ${slot.renderSize.w}`)
    expect(sfc).toContain(`h: ${slot.renderSize.h}`)
  })

  it('references images by contentHash under ./assets/', () => {
    const spec = landingSpec()
    const heroAsset = spec.assets.find((a) => a.id.includes('hero-split'))!
    const sfc = renderPage(spec, homePage(spec))
    expect(sfc).toContain(`src: "./assets/${heroAsset.contentHash}.png"`)
  })

  it('declares an assets const only for blocks that have slots', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    // StatsBand (index 1) is slotless; the other three each own slot images.
    expect(sfc).not.toContain('const assets1')
    expect(sfc).toContain('const assets0: SlotAssets')
    expect(sfc).toContain('const assets2: SlotAssets')
    expect(sfc).toContain('const assets3: SlotAssets')
  })

  it('keeps prop values in the script block, never inline in attributes', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    const template = sfc.slice(sfc.indexOf('<template>'))

    // Quotes and ampersands survive verbatim as a JS string in the script…
    expect(sfc).toContain('"subhead": "A \\"quoted\\" & ampersanded subhead"')
    // …and the template only ever references the const, so no HTML entity
    // escaping is needed and vue-tsc sees a plain identifier.
    expect(template).toContain('v-bind="props0"')
    expect(template).not.toContain('&quot;')
    expect(template).not.toContain('subhead')
  })

  it('binds props and assets separately so blocks without slots stay bare', () => {
    const spec = landingSpec()
    const sfc = renderPage(spec, homePage(spec))
    expect(sfc).toContain('const props0 = {')
    expect(sfc).toContain('const props1 = {')
    expect(sfc).not.toContain('const assets1')
  })

  it('throws when a page carries a layout component the shell already renders', () => {
    const spec = landingSpec()
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          route: '/bare',
          title: 'Bare',
          pageType: 'landing',
          blocks: [{ component: 'NavBarSimple', props: {}, assetBindings: {} }],
          operations: [],
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(CodegenError)
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(
      /NavBarSimple.*already renders around every page/,
    )
  })
})

describe('renderPage contract violations', () => {
  it('throws when a block binds a slot the component does not declare', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          ...page,
          blocks: page.blocks.map((block, index) =>
            index === 1
              ? { ...block, assetBindings: { ...block.assetBindings, sidebar: 'whatever' } }
              : block,
          ),
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(CodegenError)
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(/does not declare/)
  })

  it('throws when a binding points at an asset the manifest lacks', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    const broken: ProjectSpec = {
      ...spec,
      assets: spec.assets.filter((asset) => !asset.id.includes('hero-split')),
      pages: [page],
    }
    expect(() => renderPage(broken, page)).toThrow(/unknown asset id/)
  })

  it('throws when a manifest renderSize drifts from the sidecar', () => {
    const spec = landingSpec()
    const page = homePage(spec)
    const drifted: ProjectSpec = {
      ...spec,
      assets: spec.assets.map((asset) =>
        asset.id.includes('hero-split')
          ? { ...asset, renderSize: { w: 900, h: 675 } }
          : asset,
      ),
      pages: [page],
    }
    expect(() => renderPage(drifted, page)).toThrow(/sidecar says/)
  })

  it('throws on an unknown component', () => {
    const spec = landingSpec()
    const broken: ProjectSpec = {
      ...spec,
      pages: [
        {
          route: '/x',
          title: 'X',
          pageType: 'landing',
          blocks: [{ component: 'NotARealBlock', props: {}, assetBindings: {} }],
          operations: [],
        },
      ],
    }
    expect(() => renderPage(broken, broken.pages[0]!)).toThrow(/unknown component/)
  })

  it('throws when a block names a route no page declares', () => {
    const spec = landingSpec()
    // Only the `to` string changes. The other two pages stay declared and every
    // component, slot, asset and binding stays legal, so the new gate is the one
    // and only thing in here that can throw.
    const broken: ProjectSpec = {
      ...spec,
      pages: spec.pages.map((candidate) =>
        candidate.route !== '/'
          ? candidate
          : {
              ...candidate,
              blocks: candidate.blocks.map((block, index) =>
                index === 0
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        primaryCta: { label: 'See pricing', to: '/nope' },
                      },
                    }
                  : block,
              ),
            },
      ),
    }
    expect(() => renderPage(broken, homePage(broken))).toThrow(CodegenError)
    expect(() => renderPage(broken, homePage(broken))).toThrow(/not a declared route/)
    expect(() => renderPage(broken, homePage(broken))).toThrow(/"\/nope"/)
  })
})

describe('renderPage data-model bindings', () => {
  const spec = dataModelSpec()
  const orders = spec.pages.find((page) => page.route === '/orders')!
  const form = spec.pages.find((page) => page.route === '/orders/new')!

  it('binds a DataTable to its collection: store const, data ref, columns const', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain(`const storeOrders = useCollectionRows('orders')`)
    expect(sfc).toContain(`const dataOrders = ref(storeOrders.rows)`)
    // renderColumns 返回单层 JSON 文本（`[{"key":...}]`），断言只包一层 stringify
    expect(sfc).toContain(`const columnsOrders = ${JSON.stringify([
      { key: 'id', label: 'ID' },
      { key: 'customer', label: '客户' },
      { key: 'amount', label: '金额' },
      { key: 'status', label: '状态' },
      { key: 'created', label: '创建日期' },
      { key: 'active', label: '启用' },
    ])}`)
    expect(sfc).toContain(`:data="dataOrders"`)
    expect(sfc).toContain(`:columns="columnsOrders"`)
  })

  it('maps collection actions onto table capabilities and row actions', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain(`:searchable="true"`)
    expect(sfc).toContain(`:sortable="true"`)
    expect(sfc).toContain(`:pageable="true"`)
    expect(sfc).toContain(`:page-size="8"`)
    expect(sfc).toContain(`:row-actions="'edit,delete'"`)
  })

  it('strips the collection selector from the model props const', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).not.toContain('collection:')
    expect(sfc).toContain('"heading": "订单列表"')
  })

  it('binds row ops to page handlers that re-snapshot the table', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain('@save="saveOrders"')
    expect(sfc).toContain('@delete="deleteOrders"')
    expect(sfc).toContain('const saveOrders = (row: Record<string, unknown>) => { storeOrders.update(row); dataOrders.value = [...storeOrders.rows] }')
    expect(sfc).toContain('const deleteOrders = (row: Record<string, unknown>) => { storeOrders.remove(String(row.id)); dataOrders.value = [...storeOrders.rows] }')
  })

  it('renders an ops toolbar above the blocks with one handler per operation', () => {
    const sfc = renderPage(spec, orders)
    expect(sfc).toContain('<div class="container ops" role="toolbar">')
    expect(sfc).toContain('@click="refreshOrders"')
    expect(sfc).toContain('@click="exportOrders"')
    // route 操作在模板里内联 $router.push，不在 script 里生成 const
    expect(sfc).toContain(`@click="$router.push('/orders/new')"`)
    expect(sfc).toContain('const refreshOrders = () => { dataOrders.value = [...storeOrders.rows] }')
    expect(sfc).toContain(`const exportOrders = () => { downloadCsv('订单', storeOrders.rows) }`)
    expect(sfc).toContain(`<style scoped>`)
    expect(sfc).toContain(`.ops {`)
  })

  it('binds a FormPanel to its form: fields const, submit label, on-save handler', () => {
    const sfc = renderPage(spec, form)
    // renderFormFields 返回单层 JSON 文本，断言只包一层 stringify
    expect(sfc).toContain(`const formFieldsOrderForm = ${JSON.stringify([
      { key: 'customer', label: '客户', type: 'string', required: true, placeholder: '客户名称' },
      { key: 'amount', label: '金额', type: 'number', validate: { min: 0, max: 999999 } },
      { key: 'status', label: '状态', type: 'enum', options: ['待处理', '已发货', '已完成'] },
    ])}`)
    expect(sfc).toContain(`:fields="formFieldsOrderForm"`)
    expect(sfc).toContain(`:submit-label="'保存订单'"`)
    expect(sfc).toContain(`:on-save="onSaveOrderForm"`)
    // /orders/new 页没有 DataTable，refreshes 为空——onSave 只写 store，不带表格刷新
    expect(sfc).toContain(`const onSaveOrderForm = (row: Record<string, unknown>) => { storeOrders.update(row) }`)
    // form 选择器与 onSave 都不出现在模型 props const 里（codegen 注入/剥离）
    expect(sfc).not.toContain('"form":')
    expect(sfc).not.toContain('"collection":')
  })

  it('keeps a static FormPanel (no form) on the old code path', () => {
    const settings = spec.pages.find((page) => page.route === '/settings')!
    const sfc = renderPage(spec, settings)
    expect(sfc).not.toContain('formFields')
    expect(sfc).not.toContain('useCollectionRows')
    // 无 form 绑定的 FormPanel 走旧路径：props 直接 v-bind，没有 :fields 注入
    expect(sfc).toContain('v-bind="props0"')
    expect(sfc).not.toContain('<div class="container ops"')
  })
})
