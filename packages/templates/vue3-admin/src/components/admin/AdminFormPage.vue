<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Empty, Form, Space, message } from 'ant-design-vue'
import { collections, forms } from '../../data/mock'
import { useAdminCollection } from '../../composables/useAdminCollection'
import { validateRecord } from '../../data/validation'
import AdminPage from './AdminPage.vue'
import AdminRecordFields from './AdminRecordFields.vue'
import type { AdminFormConfig } from '../../data/admin-config'
const props = defineProps<{ title: string; config: Omit<AdminFormConfig, 'mode'> & { mode?: 'form' } }>()
const route = useRoute(), router = useRouter()
const form = forms.find(item => item.id === props.config.form)!
const collection = collections.find(item => item.id === form.collection)!
const store = useAdminCollection(collection.id)
const values = ref<Record<string, unknown>>({}), errors = ref<Record<string, string>>({})
const editing = computed(() => route.query.id !== undefined)
const record = computed(() => typeof route.query.id === 'string' ? store.get(route.query.id) : undefined)
watch(() => route.query.id, () => {
  values.value = record.value ? { ...record.value } : Object.fromEntries(form.fields.filter(field => field.type === 'boolean').map(field => [field.key, false]))
  errors.value = {}
}, { immediate: true })
async function save() {
  if (editing.value && !record.value) return
  errors.value = validateRecord(form, values.value)
  if (Object.keys(errors.value).length) return
  try {
    if (record.value) store.update(record.value.id, values.value)
    else store.create(values.value)
    message.success('已保存（本地演示）')
    await router.push(props.config.returnRoute)
  } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') }
}
</script>
<template>
  <AdminPage :title="title" description="填写业务信息；演示数据刷新后重置。">
    <template #actions><RouterLink :to="config.returnRoute">返回列表</RouterLink></template>
    <section class="form-panel">
      <Empty v-if="editing && !record" description="记录不存在，请返回列表重新选择。" />
      <Form v-else layout="vertical" @finish="save">
        <AdminRecordFields :form="form" :collection="collection" :values="values" :errors="errors" :editing="editing" :groups="config.variant === 'grouped' ? config.groups : undefined" />
        <Space><Button type="primary" @click="save">保存</Button><Button @click="router.push(config.returnRoute)">取消</Button></Space>
      </Form>
    </section>
  </AdminPage>
</template>
<style scoped>
.form-panel{max-width:800px;padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:8px}
@media(max-width:600px){.form-panel{padding:16px}}
</style>
