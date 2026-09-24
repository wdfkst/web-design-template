<script setup lang="ts">
interface Field {
  label: string
  type: string
  placeholder?: string
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    fields?: Field[]
    submitLabel?: string
  }>(),
  { heading: '', subheading: '', fields: () => [], submitLabel: '' },
)
</script>

<template>
  <section class="section form-panel">
    <div class="container form-panel__inner">
      <header v-if="heading || subheading" class="form-panel__head">
        <h2 v-if="heading" class="form-panel__title">{{ heading }}</h2>
        <p v-if="subheading" class="form-panel__sub">{{ subheading }}</p>
      </header>
      <form v-if="fields.length > 0 || submitLabel" class="form-panel__form" @submit.prevent>
        <label v-for="field in fields" :key="field.label" class="form-panel__field">
          <span class="form-panel__label">{{ field.label }}</span>
          <input
            class="form-panel__input"
            :type="field.type"
            :placeholder="field.placeholder"
          />
        </label>
        <button v-if="submitLabel" class="button form-panel__submit" type="submit">
          {{ submitLabel }}
        </button>
      </form>
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
</style>
