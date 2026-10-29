<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Descriptions, DescriptionsItem } from 'ant-design-vue'
import AdminEmptyState, { type EmptyPanel } from './AdminEmptyState.vue'
import { collections } from '../../data/mock'
import { formatAdminValue } from '../../data/format'
import { useAdminCollection } from '../../composables/useAdminCollection'
import AdminPage from './AdminPage.vue'
const props = defineProps<{ title: string; emptyPanel?: EmptyPanel; config: { collection: string; returnRoute: string } }>()
const route = useRoute()
const collection = collections.find(item => item.id === props.config.collection)!
const store = useAdminCollection(collection.id)
const record = computed(() => typeof route.query.id === 'string' ? store.get(route.query.id) : undefined)
</script>
<template>
  <AdminPage :title="title" description="查看记录的完整业务信息。">
    <template #actions><RouterLink :to="config.returnRoute">返回列表</RouterLink></template>
    <section class="detail-panel">
      <Descriptions v-if="record" title="基本信息" bordered :column="{ xs: 1, sm: 1, md: 2 }">
        <DescriptionsItem v-for="(field, key) in collection.model" :key="key" :label="field.label">{{ formatAdminValue(record[key], field.type === 'date' ? 'date' : undefined) }}</DescriptionsItem>
      </Descriptions>
      <AdminEmptyState v-else :panel="emptyPanel" description="记录不存在；新建的演示记录会在刷新后重置。" />
    </section>
  </AdminPage>
</template>
<style scoped>
.detail-panel{padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:8px}
@media(max-width:600px){.detail-panel{padding:16px}}
</style>
