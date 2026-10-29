<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Modal, Pagination, Space, Table, Tag, message } from 'ant-design-vue'
import { collections, forms } from '../../data/mock'
import type { Row } from '../../data/types'
import { formatAdminValue as display } from '../../data/format'
import { useAdminCollection } from '../../composables/useAdminCollection'
import { useAdminList } from '../../composables/useAdminList'
import AdminPage from './AdminPage.vue'
import AdminEmptyState, { type EmptyPanel } from './AdminEmptyState.vue'
import AdminFilterBar from './AdminFilterBar.vue'
import AdminRecordDrawer from './AdminRecordDrawer.vue'
interface Action { kind: string; label: string; route?: string; field?: string; value?: unknown }
import AdminRecordCards from './AdminRecordCards.vue'
import type { AdminListConfig } from '../../data/admin-config'
type ListConfig = Omit<AdminListConfig, 'mode'> & { mode?: 'list' }
import AdminWelcomePanel, { type WelcomePanel } from './AdminWelcomePanel.vue'
const props = defineProps<{ title: string; config: ListConfig; emptyPanel?: EmptyPanel; welcomePanel?: WelcomePanel }>()
const router = useRouter()
const collection = collections.find(item => item.id === props.config.collection)!
const form = forms.find(item => item.id === props.config.form)
const store = useAdminCollection(collection.id)
const { draft, page, pageSize, selected, filtered, visible, query, reset } = useAdminList(store, props.config.filters, collection.model)
const drawerOpen = ref(false), editing = ref<Row>()
const rowActions = computed(() => props.config.actions.filter(a => !['create', 'bulk-delete'].includes(a.kind)))
const columns = computed(() => [...props.config.columns.map(column => ({ title: collection.model[column.field].label, dataIndex: column.field, key: column.field, format: column.format })), ...(rowActions.value.length ? [{ title: '操作', key: '__actions', dataIndex: '__actions', format: '' }] : [])])
function toggle(id: string | number) { selected.value = selected.value.includes(id) ? selected.value.filter(key => key !== id) : [...selected.value, id] }
function cardAction(event: { id: string | number; actionIndex: number }) {
  const row = visible.value.find(item => item.id === event.id)
  const action = rowActions.value[event.actionIndex]
  if (row && action) act(action, row)
}
function open(record?: Row) { editing.value = record; drawerOpen.value = true }
function save(values: Record<string, unknown>) {
  try {
    if (editing.value) store.update(editing.value.id, values)
    else store.create(values)
    drawerOpen.value = false; reset(); message.success('已保存（本地演示）')
  } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') }
}
function remove(ids: (string | number)[]) {
  Modal.confirm({ title: `确认删除 ${ids.length} 条记录？`, content: '本次演示中删除后不可撤销。', okText: '删除', okType: 'danger', cancelText: '取消', onOk: () => { store.remove(ids); selected.value = []; message.success('已删除') } })
}
function act(action: Action, record: Record<string, unknown>) {
  const row = record as Row
  if (action.kind === 'edit') open(row)
  else if (action.kind === 'delete') remove([row.id])
  else if (action.kind === 'detail' && action.route) router.push({ path: action.route, query: { id: String(row.id) } })
  else if (action.kind === 'set-field' && action.field) {
    try { store.setField([row.id], action.field, action.value); message.success('状态已更新') }
    catch (error) { message.error(String(error)) }
  }
}
</script>
<template>
  <AdminPage :title="title" description="维护业务记录，按条件筛选并处理日常操作。">
    <AdminWelcomePanel v-if="welcomePanel" v-bind="welcomePanel" />
    <AdminFilterBar v-if="config.filters.length" :collection="collection" :fields="config.filters" :values="draft" @query="query" @reset="reset" />
    <section class="list-panel"><div class="list-toolbar"><Space><strong>{{ collection.label }}</strong><span class="muted">共 {{ filtered.length }} 条</span><Tag v-if="selected.length">已选 {{ selected.length }} 项</Tag></Space><Space>
      <template v-for="action in config.actions" :key="action.kind"><Button v-if="action.kind === 'create'" type="primary" @click="open()">{{ action.label }}</Button><Button v-else-if="action.kind === 'bulk-delete'" danger :disabled="!selected.length" @click="remove(selected)">{{ action.label }}</Button></template>
    </Space></div>
    <template v-if="config.variant === 'cards' && config.card">
      <AdminRecordCards v-if="visible.length" :rows="visible" :title-field="config.card.titleField" :summary-fields="config.card.summaryFields" :selected-ids="selected" :selectable="config.actions.some(a => a.kind === 'bulk-delete')" :model="collection.model" :actions="rowActions" @toggle="toggle" @action="cardAction" />
      <AdminEmptyState v-else :panel="emptyPanel" description="没有符合条件的记录"><Button @click="reset">清除筛选</Button></AdminEmptyState>
    </template>
    <Table v-else :columns="columns" :data-source="visible" row-key="id" :pagination="false" :scroll="{ x: 'max-content' }" size="middle" :row-selection="config.actions.some(a => a.kind === 'bulk-delete') ? { selectedRowKeys: selected, onChange: (keys: (string | number)[]) => selected = keys } : undefined">
      <template #bodyCell="{ column, record, text }"><Space v-if="column.key === '__actions'"><Button v-for="action in rowActions" :key="action.label" type="link" size="small" :danger="action.kind === 'delete'" @click="act(action, record)">{{ action.label }}</Button></Space><Tag v-else-if="config.columns.find(c => c.field === column.key)?.format === 'status'">{{ display(text) }}</Tag><span v-else>{{ display(text, config.columns.find(c => c.field === column.key)?.format) }}</span></template>
      <template #emptyText><AdminEmptyState :panel="emptyPanel" description="没有符合条件的记录"><Button @click="reset">清除筛选</Button></AdminEmptyState></template>
    </Table>
    <div class="list-pagination"><span class="muted">模拟数据 · 刷新页面后重置</span><Pagination v-model:current="page" :page-size="pageSize" :total="filtered.length" :show-size-changer="false" /></div></section>
    <AdminRecordDrawer v-if="form" :open="drawerOpen" :form="form" :collection="collection" :record="editing" @close="drawerOpen = false" @save="save" />
  </AdminPage>
</template>
<style scoped>
.list-panel{min-width:0;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-surface);overflow:hidden}.list-toolbar,.list-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 20px}.muted{font-size:12px;color:var(--admin-muted)}.list-pagination{border-top:1px solid var(--admin-border)}
</style>
