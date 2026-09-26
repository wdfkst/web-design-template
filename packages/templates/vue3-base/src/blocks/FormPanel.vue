<script setup lang="ts">
import { reactive, ref } from 'vue'

interface FormField {
  key: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  validate?: { min?: number; max?: number; pattern?: string }
  options?: string[]
}

const props = withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    fields?: FormField[]
    submitLabel?: string
    form?: string
    onSave?: (row: Record<string, unknown>) => void
  }>(),
  {
    heading: '',
    subheading: '',
    fields: () => [],
    submitLabel: '',
    form: '',
    onSave: undefined,
  },
)

// Form state lives per component instance: navigation or refresh resets it.
const model = reactive<Record<string, unknown>>({})
const errors = reactive<Record<string, string>>({})
const toast = ref('')

function errorOf(field: FormField): string {
  const value = model[field.key]
  if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
    return '此项必填'
  }
  const validate = field.validate
  if (validate === undefined) return ''
  if (field.type === 'number' && value !== undefined && value !== '') {
    const num = Number(value)
    if (validate.min !== undefined && num < validate.min) return `不能小于 ${validate.min}`
    if (validate.max !== undefined && num > validate.max) return `不能大于 ${validate.max}`
  }
  if (validate.pattern === 'email' && value !== undefined && value !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return '邮箱格式不正确'
  }
  return ''
}

function validate(): boolean {
  let valid = true
  for (const field of props.fields) {
    const message = errorOf(field)
    // Written even when empty: a field fixed after a failed submit has to lose
    // its stale message, and the template treats '' as "no error".
    errors[field.key] = message
    if (message !== '') valid = false
  }
  return valid
}

function submit(): void {
  if (!validate()) return
  const row: Record<string, unknown> = {}
  for (const field of props.fields) row[field.key] = model[field.key]
  props.onSave?.(row)
  toast.value = props.submitLabel !== '' ? props.submitLabel : '已保存'
  window.setTimeout(() => { toast.value = '' }, 2500)
  for (const key of Object.keys(model)) delete model[key]
}
</script>

<template>
  <section class="section form-panel">
    <div class="container form-panel__inner">
      <header v-if="props.heading || props.subheading" class="form-panel__head">
        <h2 v-if="props.heading" class="form-panel__title">{{ props.heading }}</h2>
        <p v-if="props.subheading" class="form-panel__sub">{{ props.subheading }}</p>
      </header>
      <form
        v-if="props.fields.length > 0 || props.submitLabel"
        class="form-panel__form"
        @submit.prevent="submit"
      >
        <label v-for="field in props.fields" :key="field.key" class="form-panel__field">
          <span class="form-panel__label">
            {{ field.label }}<span v-if="field.required" class="form-panel__required"> *</span>
          </span>
          <select
            v-if="field.type === 'enum' && field.options && field.options.length > 0"
            v-model="model[field.key]"
            class="form-panel__input"
          >
            <option value="" disabled>请选择</option>
            <option v-for="option in field.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
          <input
            v-else-if="field.type === 'boolean'"
            v-model="model[field.key]"
            class="form-panel__check"
            type="checkbox"
          />
          <input
            v-else
            v-model="model[field.key]"
            class="form-panel__input"
            :type="field.type === 'string' || field.type === 'enum' ? 'text' : field.type"
            :placeholder="field.placeholder"
          />
          <span v-if="errors[field.key]" class="form-panel__error">{{ errors[field.key] }}</span>
        </label>
        <button v-if="props.submitLabel" class="button form-panel__submit" type="submit">
          {{ props.submitLabel }}
        </button>
      </form>
      <Transition name="form-panel__toast">
        <p v-if="toast" class="form-panel__toast" role="status">{{ toast }}</p>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.form-panel__inner {
  max-width: 640px;
}

.form-panel__head {
  margin-bottom: calc(var(--space-unit) * 2);
}

.form-panel__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
}

.form-panel__sub {
  color: var(--color-muted);
  margin: 0;
}

.form-panel__form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-unit) * 1.5);
  padding: calc(var(--space-unit) * 2);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.form-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-panel__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.form-panel__input {
  padding: 0.7em 0.9em;
  border: 1px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
}

.form-panel__input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.form-panel__submit {
  align-self: flex-start;
}

.form-panel__required {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
}

.form-panel__check {
  align-self: flex-start;
  margin-top: 0.25rem;
}

.form-panel__error {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
  font-size: 0.8rem;
}

.form-panel__toast {
  margin: calc(var(--space-unit) * 1) 0 0;
  padding: 0.6em 1em;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.form-panel__toast-enter-active,
.form-panel__toast-leave-active {
  transition: opacity 0.2s ease;
}

.form-panel__toast-enter-from,
.form-panel__toast-leave-to {
  opacity: 0;
}
</style>
