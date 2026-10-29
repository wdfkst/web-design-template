<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Empty } from 'ant-design-vue'
import { collections } from '../../data/mock'
import { useAdminCollection } from '../../composables/useAdminCollection'
import AdminPage from './AdminPage.vue'
import AdminEmptyState, { type EmptyPanel } from './AdminEmptyState.vue'
import type { WorkbenchConfig } from '../../data/admin-config'
import { evaluateWorkbenchModule } from '../../data/workbench'
import AdminWorkbenchModule from './AdminWorkbenchModule.vue'
type Config = WorkbenchConfig | { mode?: 'workbench'; collections: string[]; shortcuts: string[]; modules?: never }
import AdminWelcomePanel, { type WelcomePanel } from './AdminWelcomePanel.vue'
const props = defineProps<{ title: string; emptyPanel?: EmptyPanel; welcomePanel?: WelcomePanel; config: Config }>()
const router = useRouter()
const ids = props.config.modules ? [...new Set(props.config.modules.flatMap(module => 'collection' in module ? [module.collection] : []))] : props.config.collections
const sources = ids.map(id => ({ definition: collections.find(item => item.id === id)!, store: useAdminCollection(id) }))
const modules = computed(() => {
  const config = props.config
  if (!config.modules) return []
  const ordered = [...config.modules]
  if (config.variant === 'focus') ordered.sort((a, b) => Number(b.id === config.primaryModuleId) - Number(a.id === config.primaryModuleId))
  return ordered.map(module => {
    const source = 'collection' in module ? sources.find(item => item.definition.id === module.collection) : undefined
    const model = source?.definition.model ?? {}
    return { module, model, result: evaluateWorkbenchModule(module, source?.store.rows.value ?? [], model) }
  })
})
const summaries = computed(() => sources.map(({ definition, store }) => ({ id: definition.id, label: definition.label ?? definition.id, count: store.rows.value.length })))
const shortcuts = computed(() => (props.config.shortcuts ?? []).map(path => ({ path, title: router.resolve(path).meta.title ?? path })))
</script>
<template>
  <AdminPage :title="title" description="查看业务记录概况，快速进入日常工作。">
    <AdminWelcomePanel v-if="welcomePanel" v-bind="welcomePanel" />
    <template v-if="config.modules">
      <div class="module-grid" :class="{ focus: config.variant === 'focus' }"><AdminWorkbenchModule v-for="item in modules" :key="item.module.id" v-bind="item" /></div>
      <p class="simulation-note">本地模拟数据，刷新后重置。</p>
      <AdminEmptyState v-if="emptyPanel && summaries.every(item => item.count === 0)" :panel="emptyPanel" description="暂无业务记录" />
    </template>
    <template v-else>
    <section class="overview"><h2>业务记录</h2><dl v-if="summaries.length"><div v-for="item in summaries" :key="item.id"><dt>{{ item.label }}</dt><dd data-count>{{ item.count }}</dd></div></dl><Empty v-else description="尚未配置业务集合" /><p>本地模拟数据，刷新后重置。</p></section>
    <AdminEmptyState v-if="emptyPanel && summaries.every(item => item.count === 0)" :panel="emptyPanel" description="暂无业务记录" />
    <section class="shortcuts"><h2>快捷入口</h2><nav><RouterLink v-for="item in shortcuts" :key="item.path" :to="item.path">{{ item.title }}</RouterLink></nav><Empty v-if="!shortcuts.length" description="暂无快捷入口" /></section>
    </template>
  </AdminPage>
</template>
<style scoped>
.module-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}.module-grid.focus{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.focus>:first-child{grid-column:1;grid-row:1 / span 8}.focus>:not(:first-child){grid-column:2}.simulation-note{color:var(--admin-muted);font-size:12px}@media(max-width:900px){.module-grid,.module-grid.focus{grid-template-columns:minmax(0,1fr)}.focus>:first-child,.focus>:not(:first-child){grid-column:auto;grid-row:auto}}
.overview,.shortcuts{padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:8px}.shortcuts{margin-top:20px}h2{font-size:16px;margin:0 0 20px}dl,nav{display:flex;flex-wrap:wrap;gap:24px}dl>div{min-width:140px}dt,p{color:var(--admin-muted)}dd{margin:8px 0 0;font-size:28px;font-weight:600;font-variant-numeric:tabular-nums}nav a{color:var(--admin-primary)}
</style>
