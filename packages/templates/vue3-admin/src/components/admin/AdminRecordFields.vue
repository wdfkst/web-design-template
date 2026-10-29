<script setup lang="ts">
import { FormItem, Input, InputNumber, Select, Switch } from 'ant-design-vue'
import type { CollectionDefinition, FormDefinition } from '../../data/types'
defineProps<{ form: FormDefinition; collection?: CollectionDefinition; values: Record<string, any>; errors: Record<string, string>; editing?: boolean }>()
</script>
<template>
  <FormItem v-for="field in form.fields" :key="field.key" :label="field.label" :required="field.required" :validate-status="errors[field.key] ? 'error' : undefined" :help="errors[field.key]" :html-for="`field-${form.id}-${field.key}`">
    <InputNumber v-if="field.type === 'number'" :id="`field-${form.id}-${field.key}`" v-model:value="values[field.key]" :disabled="editing && field.key === 'id'" style="width:100%" />
    <Switch v-else-if="field.type === 'boolean'" :id="`field-${form.id}-${field.key}`" v-model:checked="values[field.key]" />
    <Select v-else-if="field.type === 'enum'" :id="`field-${form.id}-${field.key}`" v-model:value="values[field.key]" :options="collection?.model[field.key]?.options?.map(value => ({ label: value, value }))" />
    <Input v-else :id="`field-${form.id}-${field.key}`" v-model:value="values[field.key]" :type="field.type === 'date' ? 'date' : 'text'" :disabled="editing && field.key === 'id'" :placeholder="field.placeholder" />
  </FormItem>
</template>
