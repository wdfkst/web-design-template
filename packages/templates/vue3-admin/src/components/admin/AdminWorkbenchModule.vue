<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { WorkbenchModule } from '../../data/admin-config'
import type { WorkbenchResult } from '../../data/workbench'
import type { FieldModel } from '../../data/types'
import { formatAdminValue } from '../../data/format'
import AdminIcon from './AdminIcon.vue'
defineProps<{ module: WorkbenchModule; result: WorkbenchResult; model: Record<string, FieldModel> }>()
const router = useRouter()
</script>
<template>
  <section class="workbench-module" :data-module="module.id">
    <header><AdminIcon :name="module.kind === 'records' ? 'document' : module.kind === 'shortcuts' ? 'app' : 'dashboard'" /><h2>{{ module.title }}</h2></header>
    <template v-if="result.kind === 'summary'"><p class="summary-value">{{ result.value === null ? '数值超出范围' : formatAdminValue(result.value) }}</p><p class="module-note">当前集合统计</p></template>
    <dl v-else-if="result.kind === 'breakdown'" class="breakdown"><div v-for="item in result.items" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.count }} 条</dd></div><p v-if="!result.items.length">暂无分类数据</p></dl>
    <template v-else-if="result.kind === 'records' && module.kind === 'records'">
      <div v-if="result.rows.length" class="records-scroll"><table><thead><tr><th v-for="field in module.fields" :key="field" scope="col">{{ model[field]?.label ?? field }}</th><th v-if="module.detailRoute" scope="col">操作</th></tr></thead><tbody><tr v-for="row in result.rows" :key="row.id"><td v-for="field in module.fields" :key="field">{{ formatAdminValue(row[field], model[field]?.type === 'date' ? 'date' : undefined) }}</td><td v-if="module.detailRoute"><RouterLink :to="{ path: module.detailRoute, query: { id: String(row.id) } }">查看详情</RouterLink></td></tr></tbody></table></div>
      <p v-else class="module-note">暂无记录</p>
    </template>
    <nav v-else-if="result.kind === 'shortcuts'" class="module-links"><RouterLink v-for="path in result.routes" :key="path" :to="path">{{ router.resolve(path).meta.title ?? path }}</RouterLink></nav>
  </section>
</template>
<style scoped>
.workbench-module{min-width:0;padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:var(--admin-radius,12px)}header{display:flex;align-items:center;gap:10px}h2{font-size:17px;margin:0;overflow-wrap:anywhere}.summary-value{font-size:36px;font-weight:600;font-variant-numeric:tabular-nums;margin:24px 0 8px;overflow-wrap:anywhere}.module-note{color:var(--admin-muted);font-size:13px}.breakdown{display:grid;gap:12px;margin:20px 0 0}.breakdown>div{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--admin-border);padding-bottom:10px}dt{overflow-wrap:anywhere}dd{margin:0;white-space:nowrap;font-variant-numeric:tabular-nums}.records-scroll{overflow-x:auto;margin-top:20px}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:12px;border-bottom:1px solid var(--admin-border);overflow-wrap:anywhere;max-width:320px}th{font-size:12px;color:var(--admin-muted);font-weight:500}a{color:var(--admin-primary)}.module-links{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px}a:focus-visible{outline:2px solid var(--admin-primary);outline-offset:4px}@media(max-width:600px){.workbench-module{padding:16px}}
</style>
