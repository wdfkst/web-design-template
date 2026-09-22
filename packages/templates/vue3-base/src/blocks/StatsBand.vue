<script setup lang="ts">
interface Stat {
  label: string
  value: string
  suffix?: string
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    stats?: Stat[]
  }>(),
  { heading: '', subheading: '', stats: () => [] },
)
</script>

<template>
  <section class="section stats">
    <div class="container">
      <header v-if="heading || subheading" class="stats__head">
        <h2 v-if="heading" class="stats__title">{{ heading }}</h2>
        <p v-if="subheading" class="stats__sub">{{ subheading }}</p>
      </header>
      <dl v-if="stats.length > 0" class="stats__grid">
        <div v-for="stat in stats" :key="stat.label" class="stats__cell">
          <dt class="stats__value">
            {{ stat.value }}<span v-if="stat.suffix" class="stats__suffix">{{ stat.suffix }}</span>
          </dt>
          <dd class="stats__label">{{ stat.label }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.stats__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 3);
}

.stats__title {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 var(--space-unit);
}

.stats__sub {
  color: var(--color-muted);
  max-width: 48ch;
  margin: 0 auto;
}

.stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: calc(var(--space-unit) * 2);
  margin: 0;
}

.stats__cell {
  text-align: center;
  padding: calc(var(--space-unit) * 2);
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.stats__value {
  font-family: var(--font-heading);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  color: var(--color-primary);
}

.stats__suffix {
  font-size: 0.6em;
}

.stats__label {
  color: var(--color-muted);
  margin-top: var(--space-unit);
}

@media (max-width: 640px) {
  .stats__grid {
    grid-template-columns: 1fr;
  }
}
</style>