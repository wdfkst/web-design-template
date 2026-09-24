<script setup lang="ts">
interface Item {
  label: string
  value: string
  tone?: string
}

const TONE_CLASS: Record<string, string> = {
  good: 'status-card__item--good',
  warn: 'status-card__item--warn',
  bad: 'status-card__item--bad',
}

withDefaults(
  defineProps<{
    heading?: string
    items?: Item[]
    icon?: string
  }>(),
  { heading: '', items: () => [], icon: '' },
)
</script>

<template>
  <section class="section status-card">
    <div class="container status-card__inner">
      <header v-if="heading || icon" class="status-card__head">
        <h2 class="status-card__title">
          {{ heading }}
          <span v-if="icon" class="status-card__icon">{{ icon }}</span>
        </h2>
      </header>
      <dl v-if="items.length > 0" class="status-card__list">
        <div
          v-for="item in items"
          :key="item.label"
          class="status-card__item"
          :class="TONE_CLASS[item.tone ?? '']"
        >
          <dt class="status-card__label">{{ item.label }}</dt>
          <dd class="status-card__value">{{ item.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.status-card__inner {
  max-width: 560px;
}

.status-card__head {
  margin-bottom: calc(var(--space-unit) * 1.5);
}

.status-card__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 700;
}

.status-card__list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.status-card__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.status-card__label {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.status-card__value {
  margin: 0;
  font-weight: 600;
}

.status-card__item--good .status-card__value {
  color: var(--color-primary);
}

.status-card__item--warn .status-card__value {
  color: var(--color-accent);
}

.status-card__item--bad .status-card__value {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
}
</style>
