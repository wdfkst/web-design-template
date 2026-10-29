<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Descriptions, DescriptionsItem } from 'ant-design-vue'
import AdminEmptyState, { type EmptyPanel } from './AdminEmptyState.vue'
import { collections } from '../../data/mock'
import { formatAdminValue } from '../../data/format'
import { useAdminCollection } from '../../composables/useAdminCollection'
import AdminPage from './AdminPage.vue'
import type { AdminDetailConfig } from '../../data/admin-config'
const props = defineProps<{ title: string; emptyPanel?: EmptyPanel; config: Omit<AdminDetailConfig, 'mode'> & { mode?: 'detail' } }>()
const route = useRoute()
const collection = collections.find(item => item.id === props.config.collection)!
const store = useAdminCollection(collection.id)
const record = computed(() => typeof route.query.id === 'string' ? store.get(route.query.id) : undefined)
const asideFields = computed(() => props.config.variant === 'aside' ? props.config.asideFields ?? [] : [])
const groups = computed(() => {
  const sections = (props.config.groups ?? []).map(group => ({ ...group, fields: group.fields.filter(key => !asideFields.value.includes(key)) })).filter(group => group.fields.length)
  const used = new Set([...asideFields.value, ...sections.flatMap(group => group.fields)])
  const remaining = Object.keys(collection.model).filter(key => !used.has(key))
  return [...sections, ...(remaining.length ? [{ id: '__remaining', title: sections.length ? '其他信息' : '基本信息', fields: remaining }] : [])]
})
</script>
<template>
  <AdminPage :title="title" description="查看记录的完整业务信息。">
    <template #actions><RouterLink :to="config.returnRoute">返回列表</RouterLink></template>
    <div v-if="record" class="detail-layout" :class="{ 'has-aside': asideFields.length }">
      <div class="detail-sections">
        <section v-for="group in groups" :key="group.id" class="detail-panel">
          <h2>{{ group.title }}</h2>
          <Descriptions bordered :column="{ xs: 1, sm: 1, md: 2 }">
            <DescriptionsItem v-for="key in group.fields" :key="key" :label="collection.model[key].label">{{ formatAdminValue(record[key], collection.model[key].type === 'date' ? 'date' : undefined) }}</DescriptionsItem>
          </Descriptions>
        </section>
      </div>
      <aside v-if="asideFields.length" class="detail-panel">
        <h2>记录摘要</h2>
        <Descriptions :column="1">
          <DescriptionsItem v-for="key in asideFields" :key="key" :label="collection.model[key].label">{{ formatAdminValue(record[key], collection.model[key].type === 'date' ? 'date' : undefined) }}</DescriptionsItem>
        </Descriptions>
      </aside>
    </div>
    <AdminEmptyState v-else :panel="emptyPanel" description="记录不存在；新建的演示记录会在刷新后重置。" />
  </AdminPage>
</template>
<style scoped>
.detail-layout,.detail-sections{display:grid;gap:20px;min-width:0}.has-aside{grid-template-columns:minmax(0,2fr) minmax(240px,1fr);align-items:start}.detail-panel{min-width:0;padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:var(--admin-radius,8px);overflow-wrap:anywhere}h2{font-size:18px;margin:0 0 20px}.detail-panel :deep(.ant-descriptions-item-content){overflow-wrap:anywhere;word-break:break-word}@media(max-width:900px){.has-aside{grid-template-columns:minmax(0,1fr)}}
@media(max-width:600px){.detail-panel{padding:16px}}
</style>
