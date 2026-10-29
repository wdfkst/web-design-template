<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Empty } from 'ant-design-vue'
import { collections } from '../../data/mock'
import { useAdminCollection } from '../../composables/useAdminCollection'
import AdminPage from './AdminPage.vue'
import AdminEmptyState, { type EmptyPanel } from './AdminEmptyState.vue'
const props = defineProps<{ title: string; emptyPanel?: EmptyPanel; config: { collections: string[]; shortcuts: string[] } }>()
const router = useRouter()
const sources = props.config.collections.map(id => ({ definition: collections.find(item => item.id === id)!, store: useAdminCollection(id) }))
const summaries = computed(() => sources.map(({ definition, store }) => ({ id: definition.id, label: definition.label ?? definition.id, count: store.rows.value.length })))
const shortcuts = computed(() => props.config.shortcuts.map(path => ({ path, title: router.resolve(path).meta.title ?? path })))
</script>
<template>
  <AdminPage :title="title" description="查看业务记录概况，快速进入日常工作。">
    <section class="overview"><h2>业务记录</h2><dl v-if="summaries.length"><div v-for="item in summaries" :key="item.id"><dt>{{ item.label }}</dt><dd data-count>{{ item.count }}</dd></div></dl><Empty v-else description="尚未配置业务集合" /><p>本地模拟数据，刷新后重置。</p></section>
    <AdminEmptyState v-if="emptyPanel && summaries.every(item => item.count === 0)" :panel="emptyPanel" description="暂无业务记录" />
    <section class="shortcuts"><h2>快捷入口</h2><nav><RouterLink v-for="item in shortcuts" :key="item.path" :to="item.path">{{ item.title }}</RouterLink></nav><Empty v-if="!shortcuts.length" description="暂无快捷入口" /></section>
  </AdminPage>
</template>
<style scoped>
.overview,.shortcuts{padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:8px}.shortcuts{margin-top:20px}h2{font-size:16px;margin:0 0 20px}dl,nav{display:flex;flex-wrap:wrap;gap:24px}dl>div{min-width:140px}dt,p{color:var(--admin-muted)}dd{margin:8px 0 0;font-size:28px;font-weight:600;font-variant-numeric:tabular-nums}nav a{color:var(--admin-primary)}
</style>
