<script setup lang="ts">
interface Stat {
  label: string
  value: string
  delta?: string
  suffix?: string
}

withDefaults(
  defineProps<{
    heading?: string
    stats?: Stat[]
  }>(),
  { heading: '', stats: () => [] },
)
</script>

<template>
  <section class="section stats-grid">
    <div class="container">
      <header v-if="heading" class="stats-grid__head">
        <h2 class="stats-grid__title">{{ heading }}</h2>
      </header>
      <div v-if="stats.length > 0" class="stats-grid__grid">
        <div v-for="stat in stats" :key="stat.label" class="stats-grid__cell">
          <dt class="stats-grid__value">
            {{ stat.value }}<span v-if="stat.suffix" class="stats-grid__suffix">{{ stat.suffix }}</span>
          </dt>
          <dd class="stats-grid__label">{{ stat.label }}</dd>
          <dd v-if="stat.delta" class="stats-grid__delta">{{ stat.delta }}</dd>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats-grid__head {
  margin-bottom: calc(var(--space-unit) * 2);
}

.stats-grid__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0;
}

.stats-grid__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: calc(var(--space-unit) * 1.5);
}

.stats-grid__cell {
  padding: calc(var(--space-unit) * 1.5);
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.stats-grid__value {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.stats-grid__suffix {
  font-size: 0.6em;
  color: var(--color-muted);
}

.stats-grid__label {
  color: var(--color-muted);
  margin: var(--space-unit) 0 0;
  font-size: 0.875rem;
}

.stats-grid__delta {
  color: var(--color-accent);
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .stats-grid__grid {
    grid-template-columns: 1fr;
  }
}
</style>
