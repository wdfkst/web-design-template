<script setup lang="ts">
import { FormItem, Input, InputNumber, Select, Switch } from 'ant-design-vue'
import type { CollectionDefinition, FormDefinition } from '../../data/types'
import type { FieldGroup } from '../../data/admin-config'
import { computed, watch } from 'vue'
const props = defineProps<{ form: FormDefinition; collection?: CollectionDefinition; values: Record<string, any>; errors: Record<string, string>; editing?: boolean; groups?: FieldGroup[] }>()
const sections = computed(() => props.groups?.map(group => ({ ...group, items: props.form.fields.filter(field => group.fields.includes(field.key)) })) ?? [{ id: '__all', title: '', items: props.form.fields }])
watch(() => props.errors, errors => {
  const field = sections.value.flatMap(section => section.items).find(field => errors[field.key] && !(props.editing && field.key === 'id'))
  if (field) document.getElementById(`field-${props.form.id}-${field.key}`)?.focus()
}, { flush: 'post' })
</script>
<template>
  <fieldset v-for="section in sections" :key="section.id" :class="{ grouped: groups }">
    <legend v-if="section.title">{{ section.title }}</legend>
  <FormItem v-for="field in section.items" :key="field.key" :label="field.label" :required="field.required" :validate-status="errors[field.key] ? 'error' : undefined" :help="errors[field.key]" :html-for="`field-${form.id}-${field.key}`">
    <InputNumber v-if="field.type === 'number'" :id="`field-${form.id}-${field.key}`" v-model:value="values[field.key]" :disabled="editing && field.key === 'id'" style="width:100%" />
    <Switch v-else-if="field.type === 'boolean'" :id="`field-${form.id}-${field.key}`" v-model:checked="values[field.key]" />
    <Select v-else-if="field.type === 'enum'" :id="`field-${form.id}-${field.key}`" v-model:value="values[field.key]" :options="collection?.model[field.key]?.options?.map(value => ({ label: value, value }))" />
    <Input v-else :id="`field-${form.id}-${field.key}`" v-model:value="values[field.key]" :type="field.type === 'date' ? 'date' : 'text'" :disabled="editing && field.key === 'id'" :placeholder="field.placeholder" />
  </FormItem>
  </fieldset>
</template>
<style scoped>
fieldset{border:0;padding:0;margin:0;min-width:0}.grouped{padding:20px;border:1px solid var(--admin-border);border-radius:var(--admin-radius,8px);margin-bottom:24px}legend{width:auto;padding:0 8px;font-size:17px;font-weight:600;color:var(--admin-text)}
</style>
