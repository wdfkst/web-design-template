<script setup lang="ts">
import type { SlotAssets } from '../asset'

interface Feature {
  title: string
  body: string
}

const props = withDefaults(
  defineProps<{
    heading?: string
    features?: Feature[]
    assets?: SlotAssets
  }>(),
  { heading: '', features: () => [], assets: () => ({}) },
)

/** Slot order is fixed by the sidecar, so index maps to slot name. */
const SLOT_NAMES = ['featureOne', 'featureTwo', 'featureThree'] as const

function assetFor(index: number) {
  const name = SLOT_NAMES[index]
  return name ? props.assets[name] : undefined
}
</script>

<template>
  <section id="features" class="section">
    <div class="container">
      <h2 v-if="heading" class="features__heading">{{ heading }}</h2>
      <ul class="features">
        <li v-for="(feature, index) in features" :key="feature.title" class="features__card">
          <!-- geometry mirrors FeatureTriad.slots.ts: each slot 1:1 512x512 -->
          <div class="features__figure">
            <img
              v-if="assetFor(index)"
              :data-asset-slot="SLOT_NAMES[index]"
              :src="assetFor(index)!.src"
              :alt="assetFor(index)!.alt"
              width="512"
              height="512"
              loading="lazy"
            />
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.body }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.features__heading {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 2);
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(var(--space-unit) * 2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.features__card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: calc(var(--space-unit) * 1.5);
  text-align: center;
}

.features__card p {
  color: var(--color-muted);
  margin: 0;
}

.features__figure {
  aspect-ratio: 1 / 1;
  width: 40%;
  margin: 0 auto var(--space-unit);
}

.features__figure img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 860px) {
  .features {
    grid-template-columns: 1fr;
  }
}
</style>
