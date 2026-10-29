<script setup lang="ts">
import { Button, Checkbox, Space } from 'ant-design-vue'
import type { Row, FieldModel } from '../../data/types'
import { formatAdminValue } from '../../data/format'
import AdminIcon from './AdminIcon.vue'
defineProps<{ rows: Row[]; titleField: string; summaryFields: string[]; selectedIds: (string | number)[]; selectable: boolean; model: Record<string, FieldModel>; actions: { kind: string; label: string }[] }>()
const emit = defineEmits<{ toggle: [id: string | number]; action: [value: { id: string | number; actionIndex: number }] }>()
</script>
<template>
  <div class="record-cards">
    <article v-for="row in rows" :key="row.id" data-record-card>
      <header><span class="record-symbol"><AdminIcon name="document" /></span><h2>{{ formatAdminValue(row[titleField]) }}</h2><Checkbox v-if="selectable" :checked="selectedIds.includes(row.id)" :aria-label="'选择 ' + formatAdminValue(row[titleField])" @change="emit('toggle', row.id)" /></header>
      <dl><div v-for="field in summaryFields" :key="field"><dt>{{ model[field]?.label ?? field }}</dt><dd>{{ formatAdminValue(row[field]) }}</dd></div></dl>
      <Space wrap><Button v-for="(action, actionIndex) in actions" :key="actionIndex" :danger="action.kind === 'delete'" size="small" @click="emit('action', { id: row.id, actionIndex })">{{ action.label }}</Button></Space>
    </article>
  </div>
</template>
<style scoped>
.record-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px;padding:20px}article{min-width:0;padding:22px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:var(--admin-radius,12px);box-shadow:var(--admin-shadow,none)}header{display:flex;align-items:center;gap:12px}h2{flex:1;min-width:0;font-size:17px;margin:0;overflow-wrap:anywhere}.record-symbol{display:grid;place-items:center;width:38px;height:42px;flex-shrink:0;border-radius:10px;background:color-mix(in srgb,var(--admin-primary) 12%,var(--admin-surface));color:var(--admin-primary)}dl{display:grid;gap:12px;margin:20px 0}dl>div{display:flex;gap:16px;justify-content:space-between}dt{color:var(--admin-muted)}dd{margin:0;overflow-wrap:anywhere;min-width:0}
</style>
