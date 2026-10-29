<script setup lang="ts">
import { ref } from 'vue'
import { Button, Form, Space, message } from 'ant-design-vue'
import { forms } from '../../data/mock'
import { readSettings, saveSettings } from '../../data/settings'
import { validateRecord } from '../../data/validation'
import AdminPage from './AdminPage.vue'
import AdminFormPage from './AdminFormPage.vue'
import AdminRecordFields from './AdminRecordFields.vue'
const props = defineProps<{ title: string; config: { form: string; returnRoute: string } }>()
const form = forms.find(item => item.id === props.config.form)!
const values = ref<Record<string, unknown>>({ ...Object.fromEntries(form.fields.filter(field => field.type === 'boolean').map(field => [field.key, false])), ...readSettings(form.id) })
const errors = ref<Record<string, string>>({})
function save() {
  errors.value = validateRecord(form, values.value)
  if (Object.keys(errors.value).length) return
  saveSettings(form.id, values.value)
  message.success('设置已保存（本地演示）')
}
</script>
<template>
  <AdminFormPage v-if="form.collection" :title="title" :config="config" />
  <AdminPage v-else :title="title" description="本地演示设置；刷新后重置，不会修改真实系统配置。">
    <template #actions><RouterLink :to="config.returnRoute">返回</RouterLink></template>
    <Form class="settings-panel" layout="vertical" @finish="save">
      <AdminRecordFields :form="form" :values="values" :errors="errors" />
      <Space><Button type="primary" @click="save">保存</Button><RouterLink :to="config.returnRoute">取消</RouterLink></Space>
    </Form>
  </AdminPage>
</template>
<style scoped>
.settings-panel{max-width:800px;padding:24px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:8px}
@media(max-width:600px){.settings-panel{padding:16px}}
</style>
