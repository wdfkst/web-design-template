import type { Asset, Collection, Page, ProjectSpec } from '@vudt/spec'
import { assertCtaTargets, BlockDerivationError, getBlockDefinition, getSlot } from '@vudt/blocks'
import { CodegenError } from './errors.js'
import { assetHref, pageComponentName } from './naming.js'

/** Serializes a prop value the model supplied into a JS literal. */
function literal(value: unknown): string {
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

function assetsById(spec: ProjectSpec): Map<string, Asset> {
  return new Map(spec.assets.map((asset) => [asset.id, asset]))
}

/**
 * Builds the `assets` object for one block.
 *
 * `w`/`h` come from the sidecar via `getSlot()`, never from the manifest entry.
 * There is deliberately only one source of truth for geometry; the manifest
 * value is still compared against it and a disagreement throws, because that
 * would mean the derivation contract was bypassed somewhere upstream.
 */
function renderBlockAssets(
  page: Page,
  blockIndex: number,
  byId: Map<string, Asset>,
): string | undefined {
  const block = page.blocks[blockIndex]!
  const definition = getBlockDefinition(block.component)
  if (!definition) {
    throw new CodegenError(
      `route "${page.route}" block ${blockIndex} uses unknown component "${block.component}"`,
    )
  }

  const entries: string[] = []
  for (const [slotName, assetId] of Object.entries(block.assetBindings)) {
    const slot = getSlot(block.component, slotName)
    if (!slot) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} (${block.component}) binds slot "${slotName}",` +
          ` which the component does not declare (declares: ` +
          `${definition.slots.map((s) => s.name).join(', ') || 'none'})`,
      )
    }

    const asset = byId.get(assetId)
    if (!asset) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} (${block.component}) slot "${slotName}"` +
          ` binds unknown asset id "${assetId}"`,
      )
    }

    if (asset.renderSize.w !== slot.renderSize.w || asset.renderSize.h !== slot.renderSize.h) {
      throw new CodegenError(
        `asset "${asset.id}" declares renderSize ${asset.renderSize.w}x${asset.renderSize.h} but` +
          ` ${block.component}.${slotName} sidecar says ` +
          `${slot.renderSize.w}x${slot.renderSize.h}`,
      )
    }

    entries.push(
      `  ${JSON.stringify(slotName)}: {\n` +
        `    src: ${JSON.stringify(assetHref(asset.contentHash))},\n` +
        `    alt: ${JSON.stringify(asset.alt)},\n` +
        `    w: ${slot.renderSize.w},\n` +
        `    h: ${slot.renderSize.h},\n` +
        `  },`,
    )
  }

  if (entries.length === 0) return undefined
  return `{\n${entries.join('\n')}\n}`
}

/**
 * kebab-case id → PascalCase 标识符片段。集合/表单的 id 只作为**后缀**出现
 * （`storeOrders`、`dataOrders`、`formFieldsOrderForm`），所以首字母必须大写。
 */
function pascalOf(id: string): string {
  return id
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')
}

/**
 * kebab-case id → camelCase 标识符（完整 const 名用）。操作 id 是独立的 const 名
 * （`refresh-orders` → `refreshOrders`），首字母小写。
 */
function camelOf(id: string): string {
  return pascalOf(id).replace(/^./, (c) => c.toLowerCase())
}

/**
 * 单引号 JS 字符串字面量，供嵌在双引号 Vue 属性里用。双引号会撞上本文件顶部
 * 记录的实体陷阱：vue-tsc 读的是未解码的原始属性文本。
 */
function attrString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** 从 spec 找集合/表单（按 id）。 */
function collectionById(spec: ProjectSpec, id: string): Collection | undefined {
  return spec.collections.find((collection) => collection.id === id)
}
function formById(spec: ProjectSpec, id: string): ProjectSpec['forms'][number] | undefined {
  return spec.forms.find((form) => form.id === id)
}

/** codegen 拥有、不得出现在模型 props const 里的键。 */
const INJECTED_PROPS = new Set([
  'collection', 'form', 'onSave', 'data', 'columns', 'searchable', 'sortable',
  'pageable', 'pageSize', 'rowActions', 'searchText',
])

/** 从集合 model 生成列定义（id 列恒在首位）。 */
function renderColumns(collection: Collection): string {
  const columns = [
    { key: 'id', label: 'ID' },
    ...collection.fields
      .filter((field) => collection.model[field] !== undefined)
      .map((field) => ({ key: field, label: collection.model[field]!.label })),
  ]
  return JSON.stringify(columns)
}

/** Renders one spec page into a Vue SFC. */
export function renderPage(spec: ProjectSpec, page: Page): string {
  const byId = assetsById(spec)
  const components = [...new Set(page.blocks.map((block) => block.component))].sort()

  const imports = components
    .map((component) => `import ${component} from '../blocks/${component}.vue'`)
    .join('\n')

  const consts: string[] = []
  const usages: string[] = []
  let needsSlotAssets = false

  // 本页引用到的集合/表单/操作。绑定循环往前三个 Set 里写，页面级 script const
  // 循环读它们决定声明哪些 store/data/columns/handler。
  const pageOps = page.operations
  const pageCollections = new Set<string>()
  const pageForms = new Set<string>()
  const pageCollectionTableIds = new Set<string>()
  const pageFilterTargets = new Set(
    page.operations
      .filter((op) => op.kind === 'filter' && op.target.startsWith('/') === false)
      .map((op) => op.target),
  )

  function renderFormFields(form: ProjectSpec['forms'][number]): string {
    const linked = form.collection === undefined ? undefined : collectionById(spec, form.collection)
    return JSON.stringify(
      form.fields.map((field) => {
        const emitted: Record<string, unknown> = {
          key: field.key,
          label: field.label,
          type: field.type,
        }
        if (field.required) emitted.required = true
        if (field.placeholder !== undefined) emitted.placeholder = field.placeholder
        if (Object.keys(field.validate).length > 0) emitted.validate = field.validate
        // enum 的 options 从关联集合的 model 取，不写在 form 里（表单 schema 没有
        // options 字段）；无关联集合时缺省由 FormPanel 渲染文本输入。
        if (field.type === 'enum' && linked !== undefined) {
          const options = linked.model[field.key]?.options
          if (options !== undefined) emitted.options = options
        }
        return emitted
      }),
    )
  }

  for (const [blockIndex, block] of page.blocks.entries()) {
    // A spec does not have to come from the draft path — a template preset or a
    // hand-edited spec reaches this function directly. Rendering a nav here would
    // put a second one under the shell's, reintroducing through the side door the
    // exact bug the layout work removed.
    if (getBlockDefinition(block.component)?.layoutOnly === true) {
      throw new CodegenError(
        `route "${page.route}" block ${blockIndex} is the layout component "${block.component}",` +
          ` which App.vue already renders around every page — remove it from pages[].blocks`,
      )
    }

    const attrs: string[] = []

    // Props go into a script const bound with v-bind rather than inline into
    // attributes. An inline JSON literal would need HTML-entity escaping, and
    // vue-tsc reads the raw attribute text before entities are decoded — so
    // `:headline="&quot;x&quot;"` builds fine under vite but fails typecheck.
    const propEntries = Object.entries(block.props).filter(
      ([key, value]) => value !== undefined && !INJECTED_PROPS.has(key),
    )
    if (propEntries.length > 0) {
      const propsName = `props${blockIndex}`
      const body = propEntries
        .map(([key, value]) => `  ${JSON.stringify(key)}: ${literal(value)},`)
        .join('\n')
      consts.push(`const ${propsName} = {\n${body}\n}`)
      attrs.push(`v-bind="${propsName}"`)
    }

    const assetsLiteral = renderBlockAssets(page, blockIndex, byId)
    if (assetsLiteral) {
      needsSlotAssets = true
      const name = `assets${blockIndex}`
      consts.push(`const ${name}: SlotAssets = ${assetsLiteral}`)
      attrs.push(`:assets="${name}"`)
    }

    if (block.component === 'DataTable') {
      const collectionId = typeof block.props.collection === 'string' ? block.props.collection : undefined
      const collection = collectionId === undefined ? undefined : collectionById(spec, collectionId)
      if (collection !== undefined) {
        const name = pascalOf(collection.id)
        pageCollections.add(collection.id)
        pageCollectionTableIds.add(collection.id)
        attrs.push(`:data="data${name}"`)
        attrs.push(`:columns="columns${name}"`)
        const actions = new Set(collection.actions)
        // searchable/sortable/pageable 三合一：声明 search 的集合就是「可操作数据表」
        attrs.push(`:searchable="${actions.has('search')}"`)
        attrs.push(`:sortable="${actions.has('search')}"`)
        attrs.push(`:pageable="${actions.has('search')}"`)
        attrs.push(`:page-size="8"`)
        // The literal list is typed as the action union, not `string[]`, so
        // `actions.has` accepts it under this package's tsconfig.
        const rowActions = (['edit', 'delete'] as const)
          .filter((kind) => actions.has(kind))
          .join(',')
        if (rowActions !== '') attrs.push(`:row-actions="'${rowActions}'"`)
        if (pageFilterTargets.has(collection.id)) {
          attrs.push(`:search-text="search${name}"`)
        }
        if (actions.has('edit')) attrs.push(`@save="save${name}"`)
        if (actions.has('delete')) attrs.push(`@delete="delete${name}"`)
      }
    }

    if (block.component === 'FormPanel') {
      const formId = typeof block.props.form === 'string' ? block.props.form : undefined
      const form = formId === undefined ? undefined : formById(spec, formId)
      if (form !== undefined) {
        const formName = pascalOf(form.id)
        pageForms.add(form.id)
        // The onSave handler writes to the linked collection's store, so that
        // store const has to be declared on this page even when no DataTable
        // put the collection there. It does NOT join pageCollectionTableIds:
        // without a table there is no data ref to re-snapshot.
        if (form.collection !== undefined && collectionById(spec, form.collection) !== undefined) {
          pageCollections.add(form.collection)
        }
        attrs.push(`:fields="formFields${formName}"`)
        attrs.push(`:submit-label="${attrString(form.submit.label)}"`)
        attrs.push(`:on-save="onSave${formName}"`)
      }
    }

    usages.push(renderTag(block.component, attrs))
  }

  // A spec does not have to come from the draft path here either — a hand-edited
  // spec reaches this function directly, and `props` is `z.unknown` in the schema,
  // so a bad `to` gets this far. It would render a dead <router-link>: a blank
  // page with no error at all, which is the exact symptom this series exists to
  // remove. The draft path keeps its own copy of this check because its error
  // text is fed back to the model as a retry turn.
  const routes = new Set(spec.pages.map((declared) => declared.route))
  try {
    assertCtaTargets(page.route, page.blocks, routes)
  } catch (error) {
    // The message already names the route, the prop path, the offending value and
    // every declared route, so it is re-thrown verbatim under this module's error.
    if (error instanceof BlockDerivationError) throw new CodegenError(error.message)
    throw error
  }

  const scriptLines: string[] = []
  const usedCollections = [...pageCollections].sort()
  const usedForms = [...pageForms].sort()

  // `ref` 只在有集合绑定或有 ops 时需要；`useCollectionRows` 只要有集合就需要；
  // `downloadCsv` 只在本页有真 export handler 时导入（避免未使用 import 的
  // verbatimModuleSyntax 编译警告）。
  if (usedCollections.length > 0 || pageOps.length > 0) scriptLines.push(`import { ref } from 'vue'`)
  const storeImports: string[] = []
  if (usedCollections.length > 0) storeImports.push('useCollectionRows')
  if (pageOps.some((op) => op.kind === 'export' && pageCollections.has(op.target))) {
    storeImports.push('downloadCsv')
  }
  if (storeImports.length > 0) {
    scriptLines.push(`import { ${storeImports.join(', ')} } from '../data/store'`)
  }
  // 保留既有行为：页面上任一块有 slot 时，assetsN const 需要 SlotAssets 类型。
  if (needsSlotAssets) scriptLines.push(`import type { SlotAssets } from '../asset'`)
  scriptLines.push(imports)
  if (consts.length > 0) scriptLines.push('')

  for (const id of usedCollections) {
    const name = pascalOf(id)
    scriptLines.push(`const store${name} = useCollectionRows('${id}')`)
    if (pageCollectionTableIds.has(id)) {
      scriptLines.push(`const data${name} = ref(store${name}.rows)`)
      scriptLines.push(`const columns${name} = ${renderColumns(collectionById(spec, id)!)}`)
    }
    const actions = new Set(collectionById(spec, id)!.actions)
    // Both handlers re-snapshot `data${name}`, which only exists alongside a
    // DataTable — and only a DataTable binds @save/@delete. Emitting them for a
    // form-only collection would reference an undeclared ref.
    if (pageCollectionTableIds.has(id) && actions.has('edit')) {
      scriptLines.push(`const save${name} = (row: Record<string, unknown>) => { store${name}.update(row); data${name}.value = [...store${name}.rows] }`)
    }
    if (pageCollectionTableIds.has(id) && actions.has('delete')) {
      scriptLines.push(`const delete${name} = (row: Record<string, unknown>) => { store${name}.remove(String(row.id)); data${name}.value = [...store${name}.rows] }`)
    }
    if (pageFilterTargets.has(id)) {
      scriptLines.push(`const search${name} = ref('')`)
    }
    // filter 的 script const 只在绑定 DataTable 时才用到（:search-text 注入），
    // 但 filter 可以挂在没有 DataTable 的页上——此时 ref 存在却无人读，无害。
  }

  for (const id of usedForms) {
    const form = formById(spec, id)!
    const name = pascalOf(id)
    scriptLines.push(`const formFields${name} = ${renderFormFields(form)}`)
    if (form.collection !== undefined && collectionById(spec, form.collection) !== undefined) {
      const storeName = pascalOf(form.collection)
      const refreshes = pageCollectionTableIds.has(form.collection)
        ? `; data${storeName}.value = [...store${storeName}.rows]`
        : ''
      scriptLines.push(`const onSave${name} = (row: Record<string, unknown>) => { store${storeName}.update(row)${refreshes} }`)
    } else {
      // 无 collection 或集合解析失败：只 toast 不写回（FormPanel 内已 toast）
      scriptLines.push(`const onSave${name} = (row: Record<string, unknown>) => { void row }`)
    }
  }

  for (const op of pageOps) {
    const name = camelOf(op.id)
    // 集合型操作只在「该集合本页有引用」时生成真 handler（store/data const 只在
    // usedCollections 循环里声明）。目标未在本页引用的操作生成无害空操作兜底——
    // 工具条模板对每个非 route 操作都引用 `@click="${camelOf(op.id)}"`，const 必须
    // 存在，否则生成的 SFC 引用未声明变量，vue-tsc 编译失败。
    if (op.kind === 'refresh' && pageCollections.has(op.target) && pageCollectionTableIds.has(op.target)) {
      const storeName = pascalOf(op.target)
      scriptLines.push(`const ${name} = () => { data${storeName}.value = [...store${storeName}.rows] }`)
    } else if (op.kind === 'export' && pageCollections.has(op.target)) {
      const storeName = pascalOf(op.target)
      scriptLines.push(`const ${name} = () => { downloadCsv(${attrString(collectionById(spec, op.target)!.label)}, store${storeName}.rows) }`)
    } else if (op.kind === 'filter' && pageCollections.has(op.target)) {
      const storeName = pascalOf(op.target)
      scriptLines.push(`const ${name} = () => { search${storeName}.value = ${JSON.stringify(op.param ?? '')} }`)
    } else if (op.kind !== 'route') {
      // 目标未在本页引用（跨页操作）或非法 target 的兜底：无害空操作。
      scriptLines.push(`const ${name} = () => { void 0 }`)
    }
    // route 操作不在此生成 const——工具条模板里已内联 `@click="$router.push(...)"`。
  }

  scriptLines.push(...consts)

  if (pageOps.length > 0) {
    const buttons = pageOps
      .map((op) => {
        const click =
          op.kind === 'route' && op.target.startsWith('/')
            ? `@click="$router.push(${attrString(op.target)})"`
            : `@click="${camelOf(op.id)}"`
        return `    <button class="button button--ghost ops__button" ${click}>${op.label}</button>`
      })
      .join('\n')
    usages.unshift(`  <div class="container ops" role="toolbar">\n${buttons}\n  </div>`)
  }

  // The template close keeps its trailing newline so a spec without operations
  // renders byte-for-byte what it rendered before this file learned about data
  // models. The style block therefore opens with one newline rather than two.
  const styleBlock =
    pageOps.length > 0
      ? `\n<style scoped>\n.ops {\n  display: flex;\n  flex-wrap: wrap;\n  gap: calc(var(--space-unit) * 0.75);\n  padding: calc(var(--space-unit) * 1.5) 0 0;\n}\n.ops__button {\n  padding: 0.4em 0.9em;\n  font-size: 0.85rem;\n}\n</style>\n`
      : ''

  return (
    `<script setup lang="ts">\n` +
    `${scriptLines.join('\n')}\n` +
    `</script>\n\n` +
    `<template>\n` +
    `${usages.join('\n')}\n` +
    `</template>\n` +
    styleBlock
  )
}

function renderTag(component: string, attrs: readonly string[]): string {
  if (attrs.length === 0) return `  <${component} />`
  if (attrs.length === 1 && attrs[0]!.length < 80) return `  <${component} ${attrs[0]} />`
  return `  <${component}\n${attrs.map((a) => `    ${a}`).join('\n')}\n  />`
}

export { pageComponentName }
