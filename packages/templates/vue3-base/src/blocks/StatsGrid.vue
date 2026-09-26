<script setup lang="ts">
interface Stat {
  label: string
  value: string
  delta?: string
  suffix?: string
  /** `'line'` or `'bar'`; anything else renders no chart. */
  chart?: string
  series?: number[]
}

/** 迷你 SVG 折线的 points 串（值归一化到 100×30 viewBox）。 */
function sparkPoints(series?: number[]): string {
  if (series === undefined || series.length === 0) return ''
  const max = Math.max(...series)
  const span = max === 0 ? 1 : max
  return series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * 100
      const y = 30 - (value / span) * 26 - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** 迷你 SVG 柱状条：每柱宽固定、高度按值归一化。 */
function sparkBars(series?: number[]): string {
  if (series === undefined || series.length === 0) return ''
  const max = Math.max(...series)
  const span = max === 0 ? 1 : max
  const width = 100 / series.length
  return series
    .map((value, index) => {
      const height = (value / span) * 26
      return `<rect x="${(index * width + width * 0.2).toFixed(1)}" y="${(28 - height).toFixed(1)}" width="${(width * 0.6).toFixed(1)}" height="${height.toFixed(1)}" />`
    })
    .join('')
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
      <dl v-if="stats.length > 0" class="stats-grid__grid">
        <div v-for="stat in stats" :key="stat.label" class="stats-grid__cell">
          <svg
            v-if="stat.chart === 'line' && stat.series && stat.series.length > 0"
            class="stats-grid__spark"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              :points="sparkPoints(stat.series)"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
            />
          </svg>
          <svg
            v-else-if="stat.chart === 'bar' && stat.series && stat.series.length > 0"
            class="stats-grid__spark"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g v-html="sparkBars(stat.series)" fill="var(--color-primary)" />
          </svg>
          <dt class="stats-grid__value">
            {{ stat.value }}<span v-if="stat.suffix" class="stats-grid__suffix">{{ stat.suffix }}</span>
          </dt>
          <dd class="stats-grid__label">{{ stat.label }}</dd>
          <dd v-if="stat.delta" class="stats-grid__delta">{{ stat.delta }}</dd>
        </div>
      </dl>
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

.stats-grid__spark {
  display: block;
  width: 100%;
  height: 40px;
  margin-bottom: calc(var(--space-unit) * 0.75);
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
  color: var(--color-foreground);
  margin: calc(var(--space-unit) * 0.25) 0 0;
  font-size: 0.875rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .stats-grid__grid {
    grid-template-columns: 1fr;
  }
}
</style>
