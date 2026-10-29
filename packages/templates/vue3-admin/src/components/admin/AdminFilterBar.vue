<script setup lang="ts">
import { Button, Input, Select } from 'ant-design-vue'
import type { CollectionDefinition } from '../../data/types'
defineProps<{ collection: CollectionDefinition; fields: string[]; values: Record<string, string | undefined> }>()
const emit = defineEmits<{ query: []; reset: [] }>()
</script>
<template>
  <form class="filter-bar" @submit.prevent="emit('query')">
    <label v-for="field in fields" :key="field" :for="`filter-${collection.id}-${field}`"><span>{{ collection.model[field].label }}</span>
      <Select v-if="collection.model[field].type === 'enum'" :id="`filter-${collection.id}-${field}`" v-model:value="values[field]" allow-clear placeholder="全部" :options="collection.model[field].options?.map(value => ({ label: value, value }))" />
      <Select v-else-if="collection.model[field].type === 'boolean'" :id="`filter-${collection.id}-${field}`" v-model:value="values[field]" allow-clear placeholder="全部" :options="[{ label: '是', value: 'true' }, { label: '否', value: 'false' }]" />
      <Input v-else :id="`filter-${collection.id}-${field}`" v-model:value="values[field]" placeholder="输入关键词" />
    </label>
    <div class="filter-actions"><Button type="primary" html-type="submit">查询</Button><Button @click="emit('reset')">重置</Button></div>
  </form>
</template>
<style scoped>
.filter-bar{display:flex;align-items:end;gap:16px;flex-wrap:wrap;padding:20px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:8px;margin-bottom:16px}
label{display:flex;flex-direction:column;gap:8px;flex:1;min-width:160px;max-width:300px;font-size:12px}.filter-actions{display:flex;gap:8px}
@media(max-width:600px){label{max-width:none;min-width:120px}.filter-bar{padding:16px}}
</style>
