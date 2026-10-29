<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Drawer, Form, Space } from 'ant-design-vue'
import type { CollectionDefinition, FormDefinition, Row } from '../../data/types'
import { validateRecord } from '../../data/validation'
import AdminRecordFields from './AdminRecordFields.vue'
const props = defineProps<{ open: boolean; form: FormDefinition; collection: CollectionDefinition; record?: Row }>()
const emit = defineEmits<{ close: []; save: [Record<string, unknown>] }>()
const values = ref<Record<string, unknown>>({})
const errors = ref<Record<string, string>>({})
watch(() => props.open, open => {
  if (!open) return
  values.value = props.record ? { ...props.record } : Object.fromEntries(props.form.fields.filter(f => f.type === 'boolean').map(f => [f.key, false]))
  errors.value = {}
}, { immediate: true })
function save() {
  errors.value = validateRecord(props.form, values.value)
  if (Object.keys(errors.value).length === 0) emit('save', { ...values.value })
}
</script>
<template>
  <Drawer :open="open" :title="`${record ? '编辑' : '新增'}${collection.label ?? ''}`" :width="480" :body-style="{ padding: '24px' }" @close="emit('close')">
    <Form layout="vertical" @finish="save"><AdminRecordFields :form="form" :collection="collection" :values="values" :errors="errors" :editing="!!record" /></Form>
    <template #footer><Space style="display:flex;justify-content:flex-end"><Button @click="emit('close')">取消</Button><Button type="primary" @click="save">保存</Button></Space></template>
  </Drawer>
</template>
