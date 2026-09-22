<script setup lang="ts">
interface Field {
  label: string
  type: string
  placeholder?: string
}

withDefaults(
  defineProps<{
    // `string`, not 'sign-in' | 'sign-up': the code generator emits page props as
    // a plain JSON const bound with v-bind, which widens the literal. A union here
    // would turn one typo in an unvalidated spec prop into a build failure for the
    // whole generated project. The intended values are documented in the sidecar.
    mode?: string
    heading?: string
    subheading?: string
    fields?: Field[]
    submitLabel?: string
    altActionLabel?: string
    note?: string
  }>(),
  {
    mode: 'sign-in',
    heading: '',
    subheading: '',
    fields: () => [],
    submitLabel: '',
    altActionLabel: '',
    note: '',
  },
)
</script>

<template>
  <section class="section auth">
    <div class="container auth__inner">
      <div class="auth__panel">
        <header class="auth__head">
          <h2 class="auth__title">{{ heading }}</h2>
          <p v-if="subheading" class="auth__sub">{{ subheading }}</p>
        </header>
        <form class="auth__form" @submit.prevent>
          <label v-for="field in fields" :key="field.label" class="auth__field">
            <span class="auth__label">{{ field.label }}</span>
            <input
              class="auth__input"
              :type="field.type"
              :placeholder="field.placeholder"
              :autocomplete="field.type === 'password' ? 'current-password' : 'on'"
            />
          </label>
          <button class="button auth__submit" type="submit">{{ submitLabel }}</button>
        </form>
        <button v-if="altActionLabel" class="auth__alt" type="button">
          {{ altActionLabel }}
        </button>
        <p v-if="note" class="auth__note">{{ note }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth__inner {
  max-width: 440px;
}

.auth__panel {
  padding: calc(var(--space-unit) * 2.5);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.auth__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 2);
}

.auth__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0 0 var(--space-unit);
}

.auth__sub {
  color: var(--color-muted);
  margin: 0;
}

.auth__form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-unit) * 1.5);
}

.auth__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.auth__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.auth__input {
  padding: 0.7em 0.9em;
  border: 1px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
}

.auth__input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.auth__submit {
  width: 100%;
  text-align: center;
}

.auth__alt {
  display: block;
  text-align: center;
  margin-top: calc(var(--space-unit) * 1.5);
  color: var(--color-primary);
  text-decoration: none;
  font-size: 0.9rem;
}

.auth__note {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.85rem;
  margin-top: var(--space-unit);
}
</style>
