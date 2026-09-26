<script setup lang="ts">
interface Item {
  label: string
  value: string
  tone?: string
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
          <svg
            v-if="item.chart === 'line' && item.series && item.series.length > 0"
            class="status-card__spark"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              :points="sparkPoints(item.series)"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
            />
          </svg>
          <svg
            v-else-if="item.chart === 'bar' && item.series && item.series.length > 0"
            class="status-card__spark"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g v-html="sparkBars(item.series)" fill="var(--color-primary)" />
          </svg>
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

.status-card__spark {
  display: block;
  width: 100%;
  height: 32px;
  margin-top: calc(var(--space-unit) * 0.5);
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
